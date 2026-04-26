'use strict';

const db = require('../config/database');

/**
 * Platform-wide KPI dashboard.
 */
async function getPlatformStats() {
  const { rows: clinics }       = await db.query("SELECT COUNT(*) FROM clinics WHERE is_active=true");
  const { rows: users }         = await db.query("SELECT COUNT(*), role FROM users GROUP BY role");
  const { rows: appointments }  = await db.query("SELECT COUNT(*), status FROM appointments GROUP BY status");
  const { rows: revenue }       = await db.query("SELECT SUM(amount) AS total_revenue FROM payments WHERE status='paid'");

  return {
    totalActiveClinics: parseInt(clinics[0].count, 10),
    usersByRole:        users.reduce((acc, r) => { acc[r.role] = parseInt(r.count, 10); return acc; }, {}),
    appointmentsByStatus: appointments.reduce((acc, r) => { acc[r.status] = parseInt(r.count, 10); return acc; }, {}),
    totalRevenue:       parseFloat(revenue[0].total_revenue) || 0,
  };
}

/**
 * List all clinics with summary (super_admin).
 */
async function listAllClinics({ page = 1, limit = 20, search }) {
  const offset = (page - 1) * limit;
  const params = [];
  let filter = '';
  if (search) { params.push(`%${search}%`); filter = `WHERE name ILIKE $${params.length} OR email ILIKE $${params.length}`; }
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT c.id, c.name, c.city, c.phone, c.email, c.is_active, c.created_at,
            COUNT(DISTINCT u.id) AS staff_count
     FROM clinics c
     LEFT JOIN users u ON u.clinic_id=c.id AND u.role<>'patient'
     ${filter}
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM clinics ${filter}`, cp);
  return { rows, total: parseInt(cr[0].count, 10) };
}

/**
 * Toggle clinic active status.
 */
async function setClinicActive(clinicId, isActive) {
  const { rows } = await db.query(
    'UPDATE clinics SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, is_active',
    [isActive, clinicId]
  );
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Audit log — record an admin action.
 */
async function createAuditLog({ actorId, action, entityType, entityId, details, ipAddress }) {
  const { v4: uuidv4 } = require('uuid');
  await db.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [uuidv4(), actorId, action, entityType, entityId, JSON.stringify(details), ipAddress]
  );
}

/**
 * Retrieve audit logs.
 */
async function getAuditLogs({ page = 1, limit = 50, actorId, entityType, action }) {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['1=1'];

  if (actorId)    { params.push(actorId);    conditions.push(`al.actor_id=$${params.length}`); }
  if (entityType) { params.push(entityType); conditions.push(`al.entity_type=$${params.length}`); }
  if (action)     { params.push(action);     conditions.push(`al.action=$${params.length}`); }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT al.*, u.email AS actor_email
     FROM audit_logs al
     JOIN users u ON u.id = al.actor_id
     WHERE ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

module.exports = { getPlatformStats, listAllClinics, setClinicActive, createAuditLog, getAuditLogs };
