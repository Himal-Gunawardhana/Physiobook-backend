'use strict';

const db = require('../config/database');

async function getMe(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role,
            u.avatar_url, u.is_active, u.notification_prefs, u.created_at,
            cs.clinic_id, cs.specialization, cs.experience_years, cs.rating, cs.status AS staff_status
     FROM users u
     LEFT JOIN clinic_staff cs ON cs.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0];
}

async function updateMe(userId, { firstName, lastName, phone, avatarUrl }) {
  const fields = [];
  const vals   = [];
  if (firstName !== undefined) { fields.push(`first_name=$${fields.length + 1}`); vals.push(firstName); }
  if (lastName  !== undefined) { fields.push(`last_name=$${fields.length + 1}`);  vals.push(lastName); }
  if (phone     !== undefined) { fields.push(`phone=$${fields.length + 1}`);      vals.push(phone); }
  if (avatarUrl !== undefined) { fields.push(`avatar_url=$${fields.length + 1}`); vals.push(avatarUrl); }

  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
  fields.push(`updated_at=NOW()`);
  vals.push(userId);

  const { rows } = await db.query(
    `UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING id,first_name,last_name,email,phone,avatar_url,role`,
    vals
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0];
}

async function getUserById(id) {
  const { rows } = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role,
            u.avatar_url, u.is_active, u.created_at,
            cs.clinic_id, cs.specialization
     FROM users u
     LEFT JOIN clinic_staff cs ON cs.user_id = u.id
     WHERE u.id = $1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0];
}

async function updateNotifPrefs(userId, prefs) {
  const { rows } = await db.query(
    `UPDATE users SET notification_prefs=$1, updated_at=NOW() WHERE id=$2 RETURNING notification_prefs`,
    [JSON.stringify(prefs), userId]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return rows[0].notification_prefs;
}

async function getNotifications(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const { rows: cr } = await db.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1', [userId]);
  return { rows, total: parseInt(cr[0].count, 10) };
}

async function deleteUser(id) {
  await db.query('UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1', [id]);
}

module.exports = { getMe, updateMe, getUserById, updateNotifPrefs, getNotifications, deleteUser };
