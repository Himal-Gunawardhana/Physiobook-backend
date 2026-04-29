'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// ── Clinics ───────────────────────────────────────────────────────────────────

async function listClinics({ page = 1, limit = 20, search, city } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  const conds  = ['c.is_active = true'];

  if (search) { params.push(`%${search}%`); conds.push(`(c.name ILIKE $${params.length} OR c.email ILIKE $${params.length})`); }
  if (city)   { params.push(city);           conds.push(`c.city ILIKE $${params.length}`); }

  const where = conds.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT c.id, c.name, c.slug, c.city, c.phone, c.email, c.logo_url,
            c.subscription_plan, c.operating_hours, c.created_at,
            COUNT(DISTINCT cs.id) AS team_count
     FROM clinics c
     LEFT JOIN clinic_staff cs ON cs.clinic_id = c.id
     WHERE ${where}
     GROUP BY c.id
     ORDER BY c.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM clinics c WHERE ${where}`, cp);
  return { rows, total: parseInt(cr[0].count, 10) };
}

async function createClinic({ name, address, city, phone, email, ownerId, subscriptionPlan, logoUrl }) {
  const slug = _slugify(name);
  const existing = await db.query('SELECT id FROM clinics WHERE slug=$1 OR email=$2', [slug, email.toLowerCase()]);
  if (existing.rows.length) throw Object.assign(new Error('A clinic with this name or email already exists'), { statusCode: 409 });

  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO clinics (id, name, slug, address, city, phone, email, owner_id, subscription_plan, logo_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, name, slug, address, city, phone, email.toLowerCase(), ownerId || null,
     subscriptionPlan || 'free', logoUrl || null]
  );
  return rows[0];
}

async function getClinicById(id) {
  const { rows } = await db.query(
    `SELECT c.*, u.first_name || ' ' || u.last_name AS owner_name, u.email AS owner_email
     FROM clinics c
     LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });

  const clinic = rows[0];
  const [{ rows: services }, { rows: packages }, { rows: teamCount }] = await Promise.all([
    db.query('SELECT id, name, duration_minutes, price, currency, is_active FROM services WHERE clinic_id=$1 AND is_active=true', [id]),
    db.query('SELECT id, name, session_count, price, discount_percent, is_fast_track FROM packages WHERE clinic_id=$1 AND is_active=true', [id]),
    db.query('SELECT COUNT(*) FROM clinic_staff WHERE clinic_id=$1', [id]),
  ]);

  return { ...clinic, services, packages, teamCount: parseInt(teamCount[0].count, 10) };
}

async function updateClinic(id, { name, address, city, phone, email, operatingHours, logoUrl }) {
  const fields = [];
  const vals   = [];
  if (name !== undefined)           { fields.push(`name=$${fields.length + 1}`);             vals.push(name); }
  if (address !== undefined)        { fields.push(`address=$${fields.length + 1}`);          vals.push(address); }
  if (city !== undefined)           { fields.push(`city=$${fields.length + 1}`);             vals.push(city); }
  if (phone !== undefined)          { fields.push(`phone=$${fields.length + 1}`);            vals.push(phone); }
  if (email !== undefined)          { fields.push(`email=$${fields.length + 1}`);            vals.push(email.toLowerCase()); }
  if (operatingHours !== undefined) { fields.push(`operating_hours=$${fields.length + 1}`); vals.push(JSON.stringify(operatingHours)); }
  if (logoUrl !== undefined)        { fields.push(`logo_url=$${fields.length + 1}`);         vals.push(logoUrl); }

  if (name) { fields.push(`slug=$${fields.length + 1}`); vals.push(_slugify(name)); }

  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
  fields.push(`updated_at=NOW()`);
  vals.push(id);

  const { rows } = await db.query(
    `UPDATE clinics SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals
  );
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0];
}

async function getPortalConfig(clinicId) {
  const { rows } = await db.query('SELECT portal_config FROM clinics WHERE id=$1', [clinicId]);
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0].portal_config;
}

async function updatePortalConfig(clinicId, config) {
  const { rows } = await db.query(
    `UPDATE clinics SET portal_config=portal_config||$1::jsonb, updated_at=NOW() WHERE id=$2 RETURNING portal_config`,
    [JSON.stringify(config), clinicId]
  );
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0].portal_config;
}

// ── Services ──────────────────────────────────────────────────────────────────

async function listServices(clinicId) {
  const { rows } = await db.query(
    'SELECT * FROM services WHERE clinic_id=$1 AND is_active=true ORDER BY name ASC', [clinicId]
  );
  return rows;
}

async function createService(clinicId, data) {
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO services (id, clinic_id, name, description, duration_minutes, price, currency, requires_equipment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, clinicId, data.name, data.description || null, data.durationMinutes,
     data.price, data.currency || 'LKR', data.requiresEquipment || null]
  );
  return rows[0];
}

async function updateService(clinicId, serviceId, data) {
  const fields = []; const vals = [];
  if (data.name               !== undefined) { fields.push(`name=$${fields.length+1}`);               vals.push(data.name); }
  if (data.description        !== undefined) { fields.push(`description=$${fields.length+1}`);        vals.push(data.description); }
  if (data.durationMinutes    !== undefined) { fields.push(`duration_minutes=$${fields.length+1}`);   vals.push(data.durationMinutes); }
  if (data.price              !== undefined) { fields.push(`price=$${fields.length+1}`);              vals.push(data.price); }
  if (data.currency           !== undefined) { fields.push(`currency=$${fields.length+1}`);           vals.push(data.currency); }
  if (data.requiresEquipment  !== undefined) { fields.push(`requires_equipment=$${fields.length+1}`); vals.push(data.requiresEquipment); }
  if (data.isActive           !== undefined) { fields.push(`is_active=$${fields.length+1}`);          vals.push(data.isActive); }
  fields.push(`updated_at=NOW()`);
  vals.push(clinicId, serviceId);
  const { rows } = await db.query(
    `UPDATE services SET ${fields.join(',')} WHERE clinic_id=$${vals.length-1} AND id=$${vals.length} RETURNING *`, vals
  );
  if (!rows.length) throw Object.assign(new Error('Service not found'), { statusCode: 404 });
  return rows[0];
}

async function deleteService(clinicId, serviceId) {
  await db.query('UPDATE services SET is_active=false, updated_at=NOW() WHERE clinic_id=$1 AND id=$2', [clinicId, serviceId]);
}

// ── Packages ──────────────────────────────────────────────────────────────────

async function listPackages(clinicId) {
  const { rows } = await db.query(
    'SELECT * FROM packages WHERE clinic_id=$1 AND is_active=true ORDER BY name ASC', [clinicId]
  );
  return rows;
}

async function createPackage(clinicId, data) {
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO packages (id, clinic_id, name, description, session_count, price, discount_percent, is_fast_track)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, clinicId, data.name, data.description || null, data.sessionCount,
     data.price, data.discountPercent || 0, data.isFastTrack || false]
  );
  return rows[0];
}

async function updatePackage(clinicId, packageId, data) {
  const fields = []; const vals = [];
  if (data.name            !== undefined) { fields.push(`name=$${fields.length+1}`);             vals.push(data.name); }
  if (data.description     !== undefined) { fields.push(`description=$${fields.length+1}`);      vals.push(data.description); }
  if (data.sessionCount    !== undefined) { fields.push(`session_count=$${fields.length+1}`);    vals.push(data.sessionCount); }
  if (data.price           !== undefined) { fields.push(`price=$${fields.length+1}`);            vals.push(data.price); }
  if (data.discountPercent !== undefined) { fields.push(`discount_percent=$${fields.length+1}`); vals.push(data.discountPercent); }
  if (data.isFastTrack     !== undefined) { fields.push(`is_fast_track=$${fields.length+1}`);    vals.push(data.isFastTrack); }
  if (data.isActive        !== undefined) { fields.push(`is_active=$${fields.length+1}`);        vals.push(data.isActive); }
  fields.push(`updated_at=NOW()`);
  vals.push(clinicId, packageId);
  const { rows } = await db.query(
    `UPDATE packages SET ${fields.join(',')} WHERE clinic_id=$${vals.length-1} AND id=$${vals.length} RETURNING *`, vals
  );
  if (!rows.length) throw Object.assign(new Error('Package not found'), { statusCode: 404 });
  return rows[0];
}

async function deletePackage(clinicId, packageId) {
  await db.query('UPDATE packages SET is_active=false, updated_at=NOW() WHERE clinic_id=$1 AND id=$2', [clinicId, packageId]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = {
  listClinics, createClinic, getClinicById, updateClinic, getPortalConfig, updatePortalConfig,
  listServices, createService, updateService, deleteService,
  listPackages, createPackage, updatePackage, deletePackage,
};
