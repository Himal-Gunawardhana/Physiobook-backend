'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

/**
 * Create a staff member (clinic_admin creates therapist / receptionist).
 */
async function createStaff({ clinicId, firstName, lastName, email, phone, role, specialisations, qualifications, bio, password }) {
  const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows.length) throw Object.assign(new Error('Email already in use'), { statusCode: 409 });

  // Use provided password (for testing/bootstrap) or generate temporary password
  const tempPassword = password || Math.random().toString(36).slice(-8) + 'Ph1!';
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const userId = uuidv4();

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, clinic_id, is_email_verified, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)`,
      [userId, firstName, lastName, email, phone, passwordHash, role, clinicId]
    );

    if (role === 'therapist') {
      await client.query(
        `INSERT INTO therapist_profiles (id, user_id, clinic_id, specialisations, qualifications, bio)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuidv4(), userId, clinicId, specialisations || [], qualifications || [], bio || '']
      );
    }
  });

  // PLACEHOLDER: Send welcome email with temp password
  // await notificationService.sendStaffWelcome(email, firstName, tempPassword);

  return { userId, email, tempPassword };
}

/**
 * Get a list of staff for a clinic.
 */
async function listStaff({ clinicId, role, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [clinicId];
  let roleFilter = '';
  if (role) { params.push(role); roleFilter = `AND u.role = $${params.length}`; }
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.avatar_url, u.is_active,
            tp.specialisations, tp.bio
     FROM users u
     LEFT JOIN therapist_profiles tp ON tp.user_id = u.id
     WHERE u.clinic_id=$1 ${roleFilter} AND u.role IN ('therapist','receptionist','clinic_admin')
     ORDER BY u.first_name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cParams = [clinicId];
  if (role) cParams.push(role);
  const { rows: cr } = await db.query(
    `SELECT COUNT(*) FROM users WHERE clinic_id=$1 ${role ? `AND role=$2` : ''} AND role IN ('therapist','receptionist','clinic_admin')`,
    cParams
  );
  return { rows, total: parseInt(cr[0].count, 10) };
}

/**
 * Get therapist profile detail.
 */
async function getTherapistProfile(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url,
            tp.specialisations, tp.qualifications, tp.bio, tp.years_of_experience, tp.consultation_fee
     FROM users u
     JOIN therapist_profiles tp ON tp.user_id = u.id
     WHERE u.id=$1`,
    [userId]
  );
  if (!rows.length) throw Object.assign(new Error('Therapist not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Get therapist availability slots.
 */
async function getAvailability(therapistId, date) {
  const { rows } = await db.query(
    `SELECT * FROM therapist_availability
     WHERE therapist_id=$1 AND available_date=$2 AND is_blocked=false
     ORDER BY start_time`,
    [therapistId, date]
  );
  return rows;
}

/**
 * Set therapist recurring weekly availability.
 */
async function setWeeklySchedule(therapistId, scheduleArray) {
  return db.withTransaction(async (client) => {
    await client.query('DELETE FROM therapist_weekly_schedule WHERE therapist_id=$1', [therapistId]);
    for (const s of scheduleArray) {
      await client.query(
        'INSERT INTO therapist_weekly_schedule (id, therapist_id, day_of_week, start_time, end_time, is_active) VALUES ($1,$2,$3,$4,$5,true)',
        [uuidv4(), therapistId, s.dayOfWeek, s.startTime, s.endTime]
      );
    }
  });
}

/**
 * Block / unblock specific availability slot.
 */
async function blockSlot(therapistId, { date, startTime, endTime, reason }) {
  const id = uuidv4();
  const { rows } = await db.query(
    'INSERT INTO therapist_availability (id,therapist_id,available_date,start_time,end_time,is_blocked,block_reason) VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING *',
    [id, therapistId, date, startTime, endTime, reason]
  );
  return rows[0];
}

/**
 * Manage clinic resources (rooms, equipment).
 */
async function listResources(clinicId) {
  const { rows } = await db.query('SELECT * FROM resources WHERE clinic_id=$1 AND is_active=true ORDER BY name', [clinicId]);
  return rows;
}

async function createResource(clinicId, { name, type, description, capacity }) {
  const id = uuidv4();
  const { rows } = await db.query(
    'INSERT INTO resources (id, clinic_id, name, type, description, capacity) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [id, clinicId, name, type, description, capacity || 1]
  );
  return rows[0];
}

module.exports = { createStaff, listStaff, getTherapistProfile, getAvailability, setWeeklySchedule, blockSlot, listResources, createResource };
