'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { sendEmail } = require('../utils/sendEmail');
const { sendSms }   = require('../utils/sendSms');

async function getNotifications(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const { rows: cr } = await db.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_read=false) AS unread FROM notifications WHERE user_id=$1`,
    [userId]
  );
  return { rows, total: parseInt(cr[0].total, 10), unreadCount: parseInt(cr[0].unread, 10) };
}

async function sendBulkNotification({ userIds, title, message, channel }) {
  let sent = 0;

  const { rows: users } = await db.query(
    `SELECT id, email, phone, notification_prefs FROM users WHERE id = ANY($1::uuid[]) AND is_active=true`,
    [userIds]
  );

  for (const user of users) {
    const prefs = user.notification_prefs || {};

    // In-app notification
    await db.query(
      `INSERT INTO notifications (id, user_id, title, message) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), user.id, title, message]
    );

    if ((channel === 'email' || channel === 'both') && prefs.email !== false && user.email) {
      sendEmail({ to: user.email, subject: title, html: `<p>${message}</p>` }).catch(() => {});
    }
    if ((channel === 'sms' || channel === 'both') && prefs.sms !== false && user.phone) {
      sendSms(user.phone, `${title}: ${message}`).catch(() => {});
    }
    sent++;
  }

  return sent;
}

async function markRead(notifId, userId) {
  await db.query(
    `UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`, [notifId, userId]
  );
}

// Internal helper — create in-app notification
async function createNotification(userId, { title, message, type = 'general', metadata = {} }) {
  await db.query(
    `INSERT INTO notifications (id, user_id, title, message, type, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
    [uuidv4(), userId, title, message, type, JSON.stringify(metadata)]
  );
}

module.exports = { getNotifications, sendBulkNotification, markRead, createNotification };
