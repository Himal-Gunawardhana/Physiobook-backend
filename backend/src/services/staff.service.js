'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db     = require('../config/database');
const { sendStaffInvite } = require('../utils/sendEmail');

// ── Staff ─────────────────────────────────────────────────────────────────────

async function listStaff(clinicId) {
  const { rows } = await db.query(
    `SELECT cs.id, cs.role_in_clinic, cs.specialization, cs.experience_years,
            cs.rating, cs.auto_rank, cs.status, cs.created_at,
            u.id AS user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
     FROM clinic_staff cs
     JOIN users u ON u.id = cs.user_id
     WHERE cs.clinic_id = $1
     ORDER BY cs.rating DESC, cs.experience_years DESC`,
    [clinicId]
  );
  return rows;
}

async function addStaff(clinicId, data) {
  let userId = data.userId;

  // Create user account if no userId supplied
  if (!userId) {
    const existing = await db.query('SELECT id FROM users WHERE email=$1', [data.email.toLowerCase()]);
    if (existing.rows.length) {
      userId = existing.rows[0].id;
    } else {
      const tempPassword = _generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      userId = uuidv4();
      await db.query(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, role, is_email_verified, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true,true)`,
        [userId, data.firstName, data.lastName, data.email.toLowerCase(), passwordHash, data.role || 'therapist']
      );

      // Send invite email (fire-and-forget)
      const clinic = await db.query('SELECT name FROM clinics WHERE id=$1', [clinicId]);
      const clinicName = clinic.rows[0]?.name || 'your clinic';
      sendStaffInvite(data.email, {
        inviteeName: `${data.firstName} ${data.lastName}`,
        clinicName,
        tempPassword,
        loginUrl: (process.env.FRONTEND_URL || 'https://physiobook.vercel.app') + '/login',
      }).catch(() => {});
    }
  }

  // Upsert clinic_staff entry
  const staffId = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO clinic_staff (id, clinic_id, user_id, role_in_clinic, specialization, experience_years, rating, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (clinic_id, user_id) DO UPDATE
       SET role_in_clinic=EXCLUDED.role_in_clinic, specialization=EXCLUDED.specialization,
           experience_years=EXCLUDED.experience_years, status=EXCLUDED.status
     RETURNING *`,
    [staffId, clinicId, userId, data.roleInClinic || 'therapist',
     data.specialization || null, data.experienceYears || 0, data.rating || 0,
     data.status || 'available']
  );

  return rows[0];
}

async function updateStaff(clinicId, staffId, data) {
  const fields = []; const vals = [];
  if (data.specialization  !== undefined) { fields.push(`specialization=$${fields.length+1}`);   vals.push(data.specialization); }
  if (data.experienceYears !== undefined) { fields.push(`experience_years=$${fields.length+1}`); vals.push(data.experienceYears); }
  if (data.rating          !== undefined) { fields.push(`rating=$${fields.length+1}`);           vals.push(data.rating); }
  if (data.status          !== undefined) { fields.push(`status=$${fields.length+1}`);           vals.push(data.status); }
  if (data.roleInClinic    !== undefined) { fields.push(`role_in_clinic=$${fields.length+1}`);   vals.push(data.roleInClinic); }
  if (data.autoRank        !== undefined) { fields.push(`auto_rank=$${fields.length+1}`);        vals.push(data.autoRank); }
  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
  vals.push(staffId, clinicId);
  const { rows } = await db.query(
    `UPDATE clinic_staff SET ${fields.join(',')} WHERE id=$${vals.length-1} AND clinic_id=$${vals.length} RETURNING *`, vals
  );
  if (!rows.length) throw Object.assign(new Error('Staff member not found'), { statusCode: 404 });
  return rows[0];
}

async function removeStaff(clinicId, staffId) {
  const { rowCount } = await db.query(
    'DELETE FROM clinic_staff WHERE id=$1 AND clinic_id=$2', [staffId, clinicId]
  );
  if (!rowCount) throw Object.assign(new Error('Staff member not found'), { statusCode: 404 });
}

// ── Availability ──────────────────────────────────────────────────────────────

async function getAvailability(staffId) {
  const { rows } = await db.query(
    'SELECT * FROM staff_availability WHERE staff_id=$1 ORDER BY day_of_week ASC', [staffId]
  );
  return rows;
}

async function setAvailability(staffId, slots) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM staff_availability WHERE staff_id=$1', [staffId]);
    for (const s of slots) {
      await client.query(
        `INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1,$2,$3,$4,$5)`,
        [staffId, s.dayOfWeek, s.startTime, s.endTime, s.isActive !== false]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getAvailability(staffId);
}

// ── Equipment ─────────────────────────────────────────────────────────────────

async function listEquipment(clinicId) {
  const { rows } = await db.query(
    'SELECT * FROM equipment WHERE clinic_id=$1 AND is_active=true ORDER BY name ASC', [clinicId]
  );
  return rows;
}

async function addEquipment(clinicId, { name, quantity, isPortable }) {
  const id = uuidv4();
  const { rows } = await db.query(
    'INSERT INTO equipment (id, clinic_id, name, quantity, is_portable) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [id, clinicId, name, quantity || 1, isPortable || false]
  );
  return rows[0];
}

async function updateEquipment(clinicId, equipId, data) {
  const fields = []; const vals = [];
  if (data.name       !== undefined) { fields.push(`name=$${fields.length+1}`);        vals.push(data.name); }
  if (data.quantity   !== undefined) { fields.push(`quantity=$${fields.length+1}`);    vals.push(data.quantity); }
  if (data.isPortable !== undefined) { fields.push(`is_portable=$${fields.length+1}`); vals.push(data.isPortable); }
  if (data.isActive   !== undefined) { fields.push(`is_active=$${fields.length+1}`);   vals.push(data.isActive); }
  fields.push(`updated_at=NOW()`);
  vals.push(clinicId, equipId);
  const { rows } = await db.query(
    `UPDATE equipment SET ${fields.join(',')} WHERE clinic_id=$${vals.length-1} AND id=$${vals.length} RETURNING *`, vals
  );
  if (!rows.length) throw Object.assign(new Error('Equipment not found'), { statusCode: 404 });
  return rows[0];
}

async function deleteEquipment(clinicId, equipId) {
  await db.query('UPDATE equipment SET is_active=false, updated_at=NOW() WHERE clinic_id=$1 AND id=$2', [clinicId, equipId]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = {
  listStaff, addStaff, updateStaff, removeStaff,
  getAvailability, setAvailability,
  listEquipment, addEquipment, updateEquipment, deleteEquipment,
};
