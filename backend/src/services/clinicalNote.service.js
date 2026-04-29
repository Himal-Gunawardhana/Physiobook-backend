'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function getNotes(patientId) {
  const { rows } = await db.query(
    `SELECT cn.*,
            tu.first_name || ' ' || tu.last_name AS therapist_name,
            b.reference AS booking_reference, b.booked_date
     FROM clinical_notes cn
     JOIN clinic_staff cs ON cs.id = cn.therapist_id
     JOIN users tu ON tu.id = cs.user_id
     JOIN bookings b ON b.id = cn.booking_id
     WHERE cn.patient_id = $1
     ORDER BY cn.created_at DESC`,
    [patientId]
  );
  return rows;
}

async function createNote({ bookingId, therapistStaffId, patientId, noteText, attachmentUrl }) {
  // Verify booking belongs to this patient and therapist
  const { rows: bRows } = await db.query(
    'SELECT patient_id, therapist_id FROM bookings WHERE id=$1', [bookingId]
  );
  if (!bRows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (bRows[0].patient_id !== patientId) throw Object.assign(new Error('Patient mismatch'), { statusCode: 400 });

  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO clinical_notes (id, booking_id, therapist_id, patient_id, note_text, attachment_url)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, bookingId, therapistStaffId, patientId, noteText, attachmentUrl || null]
  );
  return rows[0];
}

async function updateNote(noteId, therapistStaffId, { noteText, attachmentUrl }) {
  const fields = []; const vals = [];
  if (noteText      !== undefined) { fields.push(`note_text=$${fields.length+1}`);      vals.push(noteText); }
  if (attachmentUrl !== undefined) { fields.push(`attachment_url=$${fields.length+1}`); vals.push(attachmentUrl); }
  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
  fields.push(`updated_at=NOW()`);
  vals.push(noteId, therapistStaffId);
  const { rows } = await db.query(
    `UPDATE clinical_notes SET ${fields.join(',')} WHERE id=$${vals.length-1} AND therapist_id=$${vals.length} RETURNING *`, vals
  );
  if (!rows.length) throw Object.assign(new Error('Note not found or access denied'), { statusCode: 404 });
  return rows[0];
}

module.exports = { getNotes, createNote, updateNote };
