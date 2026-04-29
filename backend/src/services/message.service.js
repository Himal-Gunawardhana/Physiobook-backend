'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function _verifyParticipant(bookingId, userId) {
  const { rows } = await db.query(
    `SELECT b.patient_id, cs.user_id AS therapist_user_id, b.clinic_id,
            ca.user_id AS admin_user_id
     FROM bookings b
     LEFT JOIN clinic_staff cs ON cs.id = b.therapist_id
     LEFT JOIN clinic_staff ca ON ca.clinic_id = b.clinic_id AND ca.role_in_clinic = 'clinic_admin'
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!rows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });

  const b = rows[0];
  const isParticipant = [b.patient_id, b.therapist_user_id, b.admin_user_id].includes(userId);
  if (!isParticipant) throw Object.assign(new Error('Access denied: not a booking participant'), { statusCode: 403 });
  return b;
}

async function getMessages(bookingId, userId) {
  await _verifyParticipant(bookingId, userId);
  const { rows } = await db.query(
    `SELECT m.id, m.booking_id, m.sender_id, m.content, m.is_read, m.created_at,
            u.first_name || ' ' || u.last_name AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.booking_id = $1
     ORDER BY m.created_at ASC`,
    [bookingId]
  );
  return rows;
}

async function sendMessage(bookingId, senderId, content) {
  await _verifyParticipant(bookingId, senderId);
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO messages (id, booking_id, sender_id, content) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, bookingId, senderId, content]
  );
  return rows[0];
}

async function markRead(messageId, userId) {
  const { rows } = await db.query(
    `UPDATE messages SET is_read=true WHERE id=$1 AND sender_id<>$2 RETURNING *`,
    [messageId, userId]
  );
  if (!rows.length) return null;
  return rows[0];
}

module.exports = { getMessages, sendMessage, markRead };
