'use strict';

const WebSocket = require('ws');
const { verifyAccessToken }  = require('../utils/jwt');
const commService = require('../services/communication.service');
const logger      = require('../utils/logger');

/** Map: userId → Set<WebSocket> (one user may have multiple tabs open) */
const clients = new Map();

/**
 * Attach the WebSocket server to the existing HTTP server.
 */
function initWebSocket(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/chat' });

  wss.on('connection', async (ws, req) => {
    // ── Authenticate via token in query string ────────────────
    let user;
    try {
      const url   = new URL(req.url, `http://localhost`);
      const token = url.searchParams.get('token');
      if (!token) throw new Error('No token');
      user = verifyAccessToken(token);
    } catch {
      ws.close(4001, 'Unauthorised');
      return;
    }

    logger.info(`WS connected: user ${user.id} (${user.role})`);

    // Register client
    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);

    ws.userId = user.id;
    ws.isAlive = true;

    ws.on('pong', () => { ws.isAlive = true; });

    // ── Message handler ───────────────────────────────────────
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'SEND_MESSAGE': {
            const { conversationId, body, messageType, fileUrl } = msg.payload;

            // Persist to DB
            const saved = await commService.saveMessage({
              conversationId,
              senderId:    user.id,
              body,
              messageType: messageType || 'text',
              fileUrl,
            });

            // Broadcast to all participants in this conversation
            const broadcastPayload = JSON.stringify({
              type:    'NEW_MESSAGE',
              payload: { ...saved, senderId: user.id },
            });
            await _broadcastToConversation(conversationId, broadcastPayload, user.id);
            break;
          }

          case 'MARK_READ': {
            const { conversationId } = msg.payload;
            await commService.markAsRead(conversationId, user.id);
            ws.send(JSON.stringify({ type: 'READ_ACK', payload: { conversationId } }));
            break;
          }

          case 'TYPING': {
            const { conversationId } = msg.payload;
            await _broadcastToConversation(conversationId, JSON.stringify({
              type:    'TYPING',
              payload: { conversationId, userId: user.id },
            }), user.id);
            break;
          }

          default:
            logger.warn(`WS unknown message type: ${msg.type}`);
        }
      } catch (err) {
        logger.error('WS message error:', err);
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: err.message } }));
      }
    });

    ws.on('close', () => {
      logger.info(`WS disconnected: user ${user.id}`);
      const userSockets = clients.get(user.id);
      if (userSockets) {
        userSockets.delete(ws);
        if (!userSockets.size) clients.delete(user.id);
      }
    });

    ws.on('error', (err) => logger.error(`WS error for user ${user.id}:`, err));

    // Send welcome ack
    ws.send(JSON.stringify({ type: 'CONNECTED', payload: { userId: user.id } }));
  });

  // ── Heartbeat — detect stale connections every 30s ──────────
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server ready at ws://[host]/ws/chat');
  return wss;
}

/**
 * Send a message to all connected sockets of a given userId.
 */
function sendToUser(userId, payload) {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

/**
 * Broadcast to all participants of a conversation.
 * Looks up conversation participants from DB.
 */
async function _broadcastToConversation(conversationId, data, excludeUserId) {
  const { query } = require('../config/database');
  const { rows } = await query(
    'SELECT patient_id, therapist_id FROM conversations WHERE id=$1',
    [conversationId]
  );
  if (!rows.length) return;
  const { patient_id, therapist_id } = rows[0];
  const recipientId = patient_id === excludeUserId ? therapist_id : patient_id;
  sendToUser(recipientId, data);
  sendToUser(excludeUserId, data); // echo back to sender's other tabs
}

module.exports = { initWebSocket, sendToUser };
