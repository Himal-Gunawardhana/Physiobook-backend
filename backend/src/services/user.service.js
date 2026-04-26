'use strict';

const db     = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Get user profile by ID.
 */
async function getUserById(id) {
  const { rows } = await db.query(
    `SELECT id, first_name, last_name, email, phone, role, clinic_id,
            avatar_url, date_of_birth, gender, address, is_email_verified,
            two_fa_enabled, is_active, created_at
     FROM users WHERE id=$1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Update own profile.
 */
async function updateProfile(id, { firstName, lastName, phone, dateOfBirth, gender, address }) {
  const { rows } = await db.query(
    `UPDATE users SET
       first_name   = COALESCE($1, first_name),
       last_name    = COALESCE($2, last_name),
       phone        = COALESCE($3, phone),
       date_of_birth = COALESCE($4, date_of_birth),
       gender       = COALESCE($5, gender),
       address      = COALESCE($6, address),
       updated_at   = NOW()
     WHERE id = $7
     RETURNING id, first_name, last_name, email, phone, date_of_birth, gender, address`,
    [firstName, lastName, phone, dateOfBirth, gender, address, id]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Update user avatar URL (after S3 upload).
 * PLACEHOLDER: S3 upload is handled by the controller before calling this.
 */
async function updateAvatar(id, avatarUrl) {
  const { rows } = await db.query(
    'UPDATE users SET avatar_url=$1, updated_at=NOW() WHERE id=$2 RETURNING avatar_url',
    [avatarUrl, id]
  );
  return rows[0];
}

/**
 * Change password (authenticated user).
 */
async function changePassword(id, { currentPassword, newPassword }) {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [id]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [newHash, id]);
}

/**
 * List all users (admin use). Supports pagination and role filter.
 */
async function listUsers({ page = 1, limit = 20, role, clinicId, search }) {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['1=1'];

  if (role)     { params.push(role);     conditions.push(`role = $${params.length}`); }
  if (clinicId) { params.push(clinicId); conditions.push(`clinic_id = $${params.length}`); }
  if (search)   {
    params.push(`%${search}%`);
    conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit); params.push(offset);

  const { rows } = await db.query(
    `SELECT id, first_name, last_name, email, phone, role, clinic_id, is_active, created_at
     FROM users WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const { rows: countRows } = await db.query(`SELECT COUNT(*) FROM users WHERE ${where}`, countParams);

  return { rows, total: parseInt(countRows[0].count, 10) };
}

/**
 * Activate / deactivate a user account.
 */
async function setUserActive(id, isActive) {
  const { rows } = await db.query(
    'UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING id, is_active',
    [isActive, id]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Delete user (soft delete via is_active=false for data integrity).
 */
async function deleteUser(id) {
  await setUserActive(id, false);
}

module.exports = { getUserById, updateProfile, updateAvatar, changePassword, listUsers, setUserActive, deleteUser };
