'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function createFeedback({ bookingId, patientId, rating, comment }) {
  // Verify booking is completed and belongs to patient
  const { rows: bRows } = await db.query(
    'SELECT status, clinic_id, therapist_id FROM bookings WHERE id=$1 AND patient_id=$2', [bookingId, patientId]
  );
  if (!bRows.length) throw Object.assign(new Error('Booking not found or access denied'), { statusCode: 404 });
  if (bRows[0].status !== 'completed') throw Object.assign(new Error('Feedback can only be submitted for completed bookings'), { statusCode: 400 });

  // One feedback per booking
  const { rows: existing } = await db.query('SELECT id FROM feedback WHERE booking_id=$1', [bookingId]);
  if (existing.length) throw Object.assign(new Error('Feedback already submitted for this booking'), { statusCode: 409 });

  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO feedback (id, booking_id, patient_id, therapist_id, clinic_id, rating, comment)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, bookingId, patientId, bRows[0].therapist_id, bRows[0].clinic_id, rating, comment || null]
  );

  // Update therapist's average rating
  if (bRows[0].therapist_id) {
    await db.query(
      `UPDATE clinic_staff SET rating = (
        SELECT ROUND(AVG(f.rating)::numeric, 2) FROM feedback f WHERE f.therapist_id=$1
      ) WHERE id=$1`,
      [bRows[0].therapist_id]
    );
  }

  return rows[0];
}

async function listFeedback({ clinicId, therapistId, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = ['true']; // is_public = true for public listings
  const conds  = ['f.is_public=$1'];

  if (clinicId)    { params.push(clinicId);    conds.push(`f.clinic_id=$${params.length}`); }
  if (therapistId) { params.push(therapistId); conds.push(`f.therapist_id=$${params.length}`); }

  const where = conds.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT f.*, b.reference AS booking_reference,
            u.first_name || ' ' || u.last_name AS patient_name,
            tu.first_name || ' ' || tu.last_name AS therapist_name
     FROM feedback f
     JOIN bookings b ON b.id = f.booking_id
     JOIN users u ON u.id = f.patient_id
     LEFT JOIN clinic_staff cs ON cs.id = f.therapist_id
     LEFT JOIN users tu ON tu.id = cs.user_id
     WHERE ${where}
     ORDER BY f.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(
    `SELECT COUNT(*), ROUND(AVG(f.rating)::numeric,2) AS avg_rating FROM feedback f WHERE ${where}`, cp
  );
  return { rows, total: parseInt(cr[0].count, 10), averageRating: parseFloat(cr[0].avg_rating) || 0 };
}

async function getFeedbackById(id) {
  const { rows } = await db.query(
    `SELECT f.*, u.first_name || ' ' || u.last_name AS patient_name FROM feedback f
     JOIN users u ON u.id = f.patient_id WHERE f.id=$1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });
  return rows[0];
}

module.exports = { createFeedback, listFeedback, getFeedbackById };
