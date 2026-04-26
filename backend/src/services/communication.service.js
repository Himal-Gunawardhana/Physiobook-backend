'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Get conversation thread between a patient and a therapist.
 * Creates one if it doesn't exist.
 */
async function getOrCreateConversation(patientId, therapistId, clinicId) {
  const { rows } = await db.query(
    'SELECT * FROM conversations WHERE patient_id=$1 AND therapist_id=$2',
    [patientId, therapistId]
  );
  if (rows.length) return rows[0];

  const id = uuidv4();
  const { rows: created } = await db.query(
    'INSERT INTO conversations (id, patient_id, therapist_id, clinic_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, patientId, therapistId, clinicId]
  );
  return created[0];
}

/**
 * List conversations for a user (patient or therapist).
 */
async function listConversations(userId, role) {
  const field = role === 'patient' ? 'c.patient_id' : 'c.therapist_id';
  const { rows } = await db.query(
    `SELECT c.id, c.created_at,
            p.first_name || ' ' || p.last_name AS patient_name,
            t.first_name || ' ' || t.last_name AS therapist_name,
            m.body                             AS last_message,
            m.created_at                       AS last_message_at
     FROM conversations c
     JOIN users p ON p.id = c.patient_id
     JOIN users t ON t.id = c.therapist_id
     LEFT JOIN LATERAL (
       SELECT body, created_at FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1
     ) m ON true
     WHERE ${field}=$1
     ORDER BY m.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Get messages in a conversation.
 */
async function getMessages(conversationId, { page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT m.id, m.sender_id, m.body, m.message_type, m.file_url, m.is_read, m.created_at,
            u.first_name || ' ' || u.last_name AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id=$1
     ORDER BY m.created_at ASC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );
  return rows;
}

/**
 * Save a new message to the database.
 */
async function saveMessage({ conversationId, senderId, body, messageType = 'text', fileUrl }) {
  const id = uuidv4();
  const { rows } = await db.query(
    'INSERT INTO messages (id, conversation_id, sender_id, body, message_type, file_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [id, conversationId, senderId, body, messageType, fileUrl || null]
  );
  return rows[0];
}

/**
 * Mark messages as read.
 */
async function markAsRead(conversationId, userId) {
  await db.query(
    'UPDATE messages SET is_read=true WHERE conversation_id=$1 AND sender_id<>$2 AND is_read=false',
    [conversationId, userId]
  );
}

/**
 * Save clinical notes for a booking.
 */
async function saveClinicalNote({ bookingId, therapistId, subjectiveNote, objectiveNote, assessmentNote, planNote }) {
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO clinical_notes (id, appointment_id, therapist_id, subjective, objective, assessment, plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (appointment_id) DO UPDATE
       SET subjective=$4, objective=$5, assessment=$6, plan=$7, updated_at=NOW()
     RETURNING *`,
    [id, bookingId, therapistId, subjectiveNote, objectiveNote, assessmentNote, planNote]
  );
  return rows[0];
}

/**
 * Get clinical notes for a booking.
 */
async function getClinicalNotes(bookingId) {
  const { rows } = await db.query(
    `SELECT cn.*, u.first_name || ' ' || u.last_name AS therapist_name
     FROM clinical_notes cn
     JOIN users u ON u.id = cn.therapist_id
     WHERE cn.appointment_id=$1`,
    [bookingId]
  );
  return rows[0] || null;
}

module.exports = { getOrCreateConversation, listConversations, getMessages, saveMessage, markAsRead, saveClinicalNote, getClinicalNotes };
