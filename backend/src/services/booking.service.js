'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { autoAssignTherapist }  = require('../utils/autoAssign');
const { sendBookingConfirmation, sendBookingCreatedNotification, sendFeedbackPrompt } = require('../utils/sendEmail');

const BUFFER_MINS = 15;

/**
 * Generate PB-YYYY-NNNN reference.
 */
async function _generateReference() {
  const year = new Date().getFullYear();
  const { rows } = await db.query(`SELECT nextval('booking_seq') AS seq`);
  const seq = String(rows[0].seq).padStart(4, '0');
  return `PB-${year}-${seq}`;
}

async function createBooking(data) {
  const {
    patientId, clinicId, serviceId, packageId, visitMode,
    bookedDate, bookedTime, therapistId, payNow, notes,
    patientConfirmedEquipment,
  } = data;

  // Fetch service duration
  const { rows: svcRows } = await db.query(
    'SELECT duration_minutes FROM services WHERE id=$1 AND clinic_id=$2 AND is_active=true', [serviceId, clinicId]
  );
  if (!svcRows.length) throw Object.assign(new Error('Service not found or inactive'), { statusCode: 404 });
  const duration = svcRows[0].duration_minutes;

  // Auto-assign if no therapist specified
  let assignedStaffId = therapistId || null;
  let assignedTherapist = null;
  if (!assignedStaffId) {
    assignedTherapist = await autoAssignTherapist({ clinicId, bookedDate, bookedTime, durationMinutes: duration });
    if (!assignedTherapist) throw Object.assign(new Error('No available therapist found for the requested slot'), { statusCode: 409 });
    assignedStaffId = assignedTherapist.id;
  } else {
    // Verify supplied therapist has no conflict
    const { rows: conflict } = await db.query(
      `SELECT id FROM bookings
       WHERE therapist_id=$1 AND booked_date=$2 AND status NOT IN ('cancelled','refund_requested')
       AND booked_time < ($3::time + ($4 || ' minutes')::interval)
       AND (booked_time + (duration_minutes || ' minutes')::interval) > ($3::time - ($5 || ' minutes')::interval)`,
      [assignedStaffId, bookedDate, bookedTime, duration, BUFFER_MINS]
    );
    if (conflict.length) throw Object.assign(new Error('Therapist is not available for the selected time'), { statusCode: 409 });
  }

  const reference = await _generateReference();
  const id = uuidv4();

  const { rows } = await db.query(
    `INSERT INTO bookings
       (id, reference, clinic_id, patient_id, therapist_id, service_id, package_id,
        visit_mode, booked_date, booked_time, duration_minutes, notes,
        patient_confirmed_equipment, status, payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending','unpaid') RETURNING *`,
    [id, reference, clinicId, patientId, assignedStaffId, serviceId, packageId || null,
     visitMode || 'clinic', bookedDate, bookedTime, duration, notes || null,
     patientConfirmedEquipment || false]
  );

  const booking = rows[0];

  // Fire-and-forget notifications
  _notifyBookingCreated(booking).catch(() => {});

  return { ...booking, assignedTherapist };
}

async function getBookingById(id) {
  const { rows } = await db.query(
    `SELECT b.*,
            u.first_name  || ' ' || u.last_name  AS patient_name,
            u.email  AS patient_email, u.phone AS patient_phone,
            tu.first_name || ' ' || tu.last_name AS therapist_name,
            s.name AS service_name, s.price, s.currency,
            c.name AS clinic_name, c.address AS clinic_address,
            pk.name AS package_name
     FROM bookings b
     JOIN users u ON u.id = b.patient_id
     LEFT JOIN clinic_staff cs ON cs.id = b.therapist_id
     LEFT JOIN users tu ON tu.id = cs.user_id
     JOIN services s ON s.id = b.service_id
     JOIN clinics c ON c.id = b.clinic_id
     LEFT JOIN packages pk ON pk.id = b.package_id
     WHERE b.id = $1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  return rows[0];
}

async function listBookings({ page = 1, limit = 20, clinicId, patientId, therapistId, status, date } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  const conds  = ['1=1'];

  if (clinicId)    { params.push(clinicId);    conds.push(`b.clinic_id=$${params.length}`); }
  if (patientId)   { params.push(patientId);   conds.push(`b.patient_id=$${params.length}`); }
  if (therapistId) { params.push(therapistId); conds.push(`b.therapist_id=$${params.length}`); }
  if (status)      { params.push(status);      conds.push(`b.status=$${params.length}`); }
  if (date)        { params.push(date);        conds.push(`b.booked_date=$${params.length}`); }

  const where = conds.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT b.id, b.reference, b.booked_date, b.booked_time, b.duration_minutes,
            b.status, b.payment_status, b.visit_mode,
            u.first_name || ' ' || u.last_name AS patient_name,
            tu.first_name || ' ' || tu.last_name AS therapist_name,
            s.name AS service_name, s.price
     FROM bookings b
     JOIN users u ON u.id = b.patient_id
     LEFT JOIN clinic_staff cs ON cs.id = b.therapist_id
     LEFT JOIN users tu ON tu.id = cs.user_id
     JOIN services s ON s.id = b.service_id
     WHERE ${where}
     ORDER BY b.booked_date DESC, b.booked_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM bookings b WHERE ${where}`, cp);
  return { rows, total: parseInt(cr[0].count, 10) };
}

async function updateBookingStatus(bookingId, newStatus, updatedById) {
  const VALID = ['confirmed', 'in_progress', 'completed', 'cancelled', 'refund_requested'];
  if (!VALID.includes(newStatus)) throw Object.assign(new Error(`Invalid status: ${newStatus}`), { statusCode: 400 });

  const current = await getBookingById(bookingId);

  // Enforce status flow
  const FLOW = {
    pending:          ['confirmed', 'cancelled'],
    confirmed:        ['in_progress', 'cancelled', 'refund_requested'],
    in_progress:      ['completed', 'cancelled'],
    completed:        ['refund_requested'],
    cancelled:        [],
    refund_requested: ['cancelled'],
  };
  if (!FLOW[current.status]?.includes(newStatus)) {
    throw Object.assign(
      new Error(`Cannot transition booking from '${current.status}' to '${newStatus}'`),
      { statusCode: 400 }
    );
  }

  const { rows } = await db.query(
    `UPDATE bookings SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [newStatus, bookingId]
  );

  // Fire-and-forget notifications
  if (newStatus === 'confirmed') {
    _notifyBookingConfirmed(rows[0]).catch(() => {});
  }
  if (newStatus === 'completed') {
    _promptFeedback(rows[0]).catch(() => {});
  }

  return rows[0];
}

async function deleteBooking(bookingId, user) {
  const booking = await getBookingById(bookingId);

  if (user.role === 'patient') {
    if (booking.patient_id !== user.id) throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    if (booking.status !== 'pending') throw Object.assign(new Error('Only pending bookings can be cancelled by patients'), { statusCode: 400 });
  }

  await db.query(`UPDATE bookings SET status='cancelled', updated_at=NOW() WHERE id=$1`, [bookingId]);
}

async function autoAssign(bookingId) {
  const booking = await getBookingById(bookingId);
  const assigned = await autoAssignTherapist({
    clinicId: booking.clinic_id, bookedDate: booking.booked_date,
    bookedTime: booking.booked_time, durationMinutes: booking.duration_minutes,
  });
  if (!assigned) throw Object.assign(new Error('No available therapist found'), { statusCode: 409 });

  const { rows } = await db.query(
    `UPDATE bookings SET therapist_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [assigned.id, bookingId]
  );
  return { booking: rows[0], assignedTherapist: assigned };
}

async function getAvailableSlots({ therapistId, clinicId, date, serviceDuration }) {
  const duration = parseInt(serviceDuration, 10) || 60;
  const dow      = new Date(date).getDay();

  let staffIds = [];
  if (therapistId) {
    staffIds = [therapistId];
  } else if (clinicId) {
    const { rows } = await db.query(
      `SELECT cs.id FROM clinic_staff cs WHERE cs.clinic_id=$1 AND cs.status='available'`, [clinicId]
    );
    staffIds = rows.map((r) => r.id);
  }

  if (!staffIds.length) return [];

  const allSlots = new Set();

  for (const sid of staffIds) {
    const { rows: schedule } = await db.query(
      `SELECT start_time, end_time FROM staff_availability
       WHERE staff_id=$1 AND day_of_week=$2 AND is_active=true`,
      [sid, dow]
    );
    if (!schedule.length) continue;

    const { rows: booked } = await db.query(
      `SELECT booked_time, duration_minutes FROM bookings
       WHERE therapist_id=$1 AND booked_date=$2 AND status NOT IN ('cancelled','refund_requested')`,
      [sid, date]
    );

    for (const period of schedule) {
      const start  = _toMins(period.start_time);
      const end    = _toMins(period.end_time);
      let cursor   = start;
      while (cursor + duration <= end) {
        const slotEnd   = cursor + duration;
        const conflict  = booked.some((b) => {
          const bStart = _toMins(b.booked_time);
          const bEnd   = bStart + b.duration_minutes + BUFFER_MINS;
          return bStart < slotEnd + BUFFER_MINS && bEnd > cursor;
        });
        if (!conflict) allSlots.add(_fromMins(cursor));
        cursor += duration;
      }
    }
  }

  return Array.from(allSlots).sort();
}

// ── Notification helpers ──────────────────────────────────────────────────────
async function _notifyBookingCreated(booking) {
  const { rows: patientRows } = await db.query('SELECT email, first_name, last_name FROM users WHERE id=$1', [booking.patient_id]);
  const { rows: clinicRows }  = await db.query(
    `SELECT c.name, u.email AS admin_email, u.first_name AS admin_name
     FROM clinics c
     LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`, [booking.clinic_id]
  );
  const { rows: svcRows } = await db.query('SELECT name FROM services WHERE id=$1', [booking.service_id]);

  const patient = patientRows[0];
  const clinic  = clinicRows[0];
  const svc     = svcRows[0];

  if (patient && clinic && svc) {
    // Notify admin
    if (clinic.admin_email) {
      sendBookingCreatedNotification(clinic.admin_email, {
        clinicAdminName: clinic.admin_name || 'Clinic Admin',
        reference: booking.reference,
        patientName: `${patient.first_name} ${patient.last_name}`,
        date: booking.booked_date,
        time: booking.booked_time,
      }).catch(() => {});
    }
  }
}

async function _notifyBookingConfirmed(booking) {
  const { rows: patientRows } = await db.query('SELECT email, first_name, last_name FROM users WHERE id=$1', [booking.patient_id]);
  const { rows: clinicRows }  = await db.query('SELECT name, address FROM clinics WHERE id=$1', [booking.clinic_id]);
  const { rows: svcRows }     = await db.query('SELECT name FROM services WHERE id=$1', [booking.service_id]);
  const { rows: therapistRows } = await db.query(
    `SELECT u.first_name || ' ' || u.last_name AS name FROM clinic_staff cs JOIN users u ON u.id=cs.user_id WHERE cs.id=$1`,
    [booking.therapist_id]
  );

  const patient   = patientRows[0];
  const clinic    = clinicRows[0];
  const svc       = svcRows[0];
  const therapist = therapistRows[0];

  if (patient && clinic && svc) {
    sendBookingConfirmation(patient.email, {
      patientName:   `${patient.first_name} ${patient.last_name}`,
      reference:     booking.reference,
      date:          booking.booked_date,
      time:          booking.booked_time,
      serviceName:   svc.name,
      clinicName:    clinic.name,
      therapistName: therapist?.name || 'TBA',
      visitMode:     booking.visit_mode,
    }).catch(() => {});
  }
}

async function _promptFeedback(booking) {
  const { rows: patientRows } = await db.query('SELECT email, first_name FROM users WHERE id=$1', [booking.patient_id]);
  const patient = patientRows[0];
  if (patient) {
    sendFeedbackPrompt(patient.email, {
      patientName: patient.first_name,
      reference:   booking.reference,
      bookingId:   booking.id,
    }).catch(() => {});
  }
}

function _toMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function _fromMins(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

module.exports = {
  createBooking, getBookingById, listBookings,
  updateBookingStatus, deleteBooking, autoAssign, getAvailableSlots,
};
