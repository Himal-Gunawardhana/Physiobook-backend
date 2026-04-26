'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const notificationService = require('./notification.service');

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];

/**
 * Create a new booking/appointment.
 */
async function createBooking({ patientId, clinicId, therapistId, serviceId, resourceId, appointmentDate, startTime, endTime, notes }) {
  // Check for therapist conflicts
  const conflict = await db.query(
    `SELECT id FROM appointments
     WHERE therapist_id=$1 AND appointment_date=$2
       AND status NOT IN ('cancelled','no_show')
       AND (start_time, end_time) OVERLAPS ($3::time, $4::time)`,
    [therapistId, appointmentDate, startTime, endTime]
  );
  if (conflict.rows.length) throw Object.assign(new Error('Therapist is not available for the selected time'), { statusCode: 409 });

  const id = uuidv4();
  const bookingRef = `PB-${Date.now().toString(36).toUpperCase()}`;

  const { rows } = await db.query(
    `INSERT INTO appointments
       (id, booking_ref, patient_id, clinic_id, therapist_id, service_id, resource_id,
        appointment_date, start_time, end_time, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
     RETURNING *`,
    [id, bookingRef, patientId, clinicId, therapistId, serviceId, resourceId || null, appointmentDate, startTime, endTime, notes]
  );
  const booking = rows[0];

  // PLACEHOLDER: Send confirmation notification
  await notificationService.sendBookingConfirmation(patientId, booking);

  return booking;
}

/**
 * Get booking by ID (with full details via JOIN).
 */
async function getBookingById(id) {
  const { rows } = await db.query(
    `SELECT a.*,
            p.first_name  || ' ' || p.last_name  AS patient_name,  p.email AS patient_email, p.phone AS patient_phone,
            t.first_name  || ' ' || t.last_name  AS therapist_name,
            cs.name AS service_name, cs.duration_minutes, cs.price,
            c.name AS clinic_name
     FROM appointments a
     JOIN users p  ON p.id  = a.patient_id
     JOIN users t  ON t.id  = a.therapist_id
     JOIN clinic_services cs ON cs.id = a.service_id
     JOIN clinics c ON c.id = a.clinic_id
     WHERE a.id=$1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * List bookings with filters and pagination.
 */
async function listBookings({ page = 1, limit = 20, clinicId, patientId, therapistId, status, date, dateFrom, dateTo }) {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['1=1'];

  if (clinicId)    { params.push(clinicId);   conditions.push(`a.clinic_id=$${params.length}`); }
  if (patientId)   { params.push(patientId);  conditions.push(`a.patient_id=$${params.length}`); }
  if (therapistId) { params.push(therapistId);conditions.push(`a.therapist_id=$${params.length}`); }
  if (status)      { params.push(status);     conditions.push(`a.status=$${params.length}`); }
  if (date)        { params.push(date);       conditions.push(`a.appointment_date=$${params.length}`); }
  if (dateFrom)    { params.push(dateFrom);   conditions.push(`a.appointment_date >= $${params.length}`); }
  if (dateTo)      { params.push(dateTo);     conditions.push(`a.appointment_date <= $${params.length}`); }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT a.id, a.booking_ref, a.appointment_date, a.start_time, a.end_time, a.status,
            p.first_name || ' ' || p.last_name AS patient_name,
            t.first_name || ' ' || t.last_name AS therapist_name,
            cs.name AS service_name, cs.price
     FROM appointments a
     JOIN users p  ON p.id = a.patient_id
     JOIN users t  ON t.id = a.therapist_id
     JOIN clinic_services cs ON cs.id = a.service_id
     WHERE ${where}
     ORDER BY a.appointment_date DESC, a.start_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cParams = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM appointments a WHERE ${where}`, cParams);
  return { rows, total: parseInt(cr[0].count, 10) };
}

/**
 * Update booking status.
 */
async function updateBookingStatus(id, status, updatedById) {
  if (!VALID_STATUSES.includes(status)) throw Object.assign(new Error(`Invalid status: ${status}`), { statusCode: 400 });

  const { rows } = await db.query(
    `UPDATE appointments SET status=$1, updated_by=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
    [status, updatedById, id]
  );
  if (!rows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });

  // Notify patient of status change
  await notificationService.sendBookingStatusUpdate(rows[0].patient_id, rows[0], status);

  return rows[0];
}

/**
 * Reschedule a booking.
 */
async function rescheduleBooking(id, { appointmentDate, startTime, endTime, updatedById }) {
  const booking = await getBookingById(id);
  if (['cancelled', 'completed'].includes(booking.status)) {
    throw Object.assign(new Error('Cannot reschedule a cancelled or completed booking'), { statusCode: 400 });
  }

  // Check new slot availability
  const conflict = await db.query(
    `SELECT id FROM appointments
     WHERE therapist_id=$1 AND appointment_date=$2 AND id<>$3
       AND status NOT IN ('cancelled','no_show')
       AND (start_time, end_time) OVERLAPS ($4::time, $5::time)`,
    [booking.therapist_id, appointmentDate, id, startTime, endTime]
  );
  if (conflict.rows.length) throw Object.assign(new Error('New time slot is not available'), { statusCode: 409 });

  const { rows } = await db.query(
    `UPDATE appointments SET appointment_date=$1, start_time=$2, end_time=$3, status='pending', updated_by=$4, updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [appointmentDate, startTime, endTime, updatedById, id]
  );
  return rows[0];
}

/**
 * Cancel a booking.
 */
async function cancelBooking(id, { reason, cancelledById }) {
  const { rows } = await db.query(
    `UPDATE appointments SET status='cancelled', cancellation_reason=$1, updated_by=$2, updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [reason, cancelledById, id]
  );
  if (!rows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Get available time slots for a therapist on a given date.
 */
async function getAvailableSlots({ therapistId, date, serviceDuration }) {
  // Get therapist working hours for that day
  const dow = new Date(date).getDay(); // 0=Sun
  const { rows: schedule } = await db.query(
    'SELECT start_time, end_time FROM therapist_weekly_schedule WHERE therapist_id=$1 AND day_of_week=$2 AND is_active=true',
    [therapistId, dow]
  );
  if (!schedule.length) return [];

  // Get existing bookings
  const { rows: booked } = await db.query(
    `SELECT start_time, end_time FROM appointments
     WHERE therapist_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled','no_show')`,
    [therapistId, date]
  );

  // Generate slots
  const slots = [];
  for (const period of schedule) {
    const start   = _timeToMins(period.start_time);
    const end     = _timeToMins(period.end_time);
    let cursor    = start;
    while (cursor + serviceDuration <= end) {
      const slotStart = _minsToTime(cursor);
      const slotEnd   = _minsToTime(cursor + serviceDuration);
      const isBooked  = booked.some(b => _timeToMins(b.start_time) < cursor + serviceDuration && _timeToMins(b.end_time) > cursor);
      if (!isBooked) slots.push({ startTime: slotStart, endTime: slotEnd });
      cursor += serviceDuration;
    }
  }
  return slots;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function _minsToTime(m) {
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const min = String(m % 60).padStart(2, '0');
  return `${h}:${min}`;
}

module.exports = { createBooking, getBookingById, listBookings, updateBookingStatus, rescheduleBooking, cancelBooking, getAvailableSlots };
