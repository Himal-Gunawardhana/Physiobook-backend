'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Create a new clinic (super_admin only).
 */
async function createClinic({ name, addressLine1, addressLine2, city, state, postalCode, country, phone, email, website, licenseNumber, description }) {
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO clinics
       (id, name, address_line1, address_line2, city, state, postal_code, country,
        phone, email, website, license_number, description, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
     RETURNING *`,
    [id, name, addressLine1, addressLine2, city, state, postalCode, country, phone, email, website, licenseNumber, description]
  );
  return rows[0];
}

/**
 * Get clinic details by ID.
 */
async function getClinicById(id) {
  const { rows } = await db.query('SELECT * FROM clinics WHERE id=$1', [id]);
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * List clinics with pagination and search.
 */
async function listClinics({ page = 1, limit = 20, search, city, isActive }) {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['1=1'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (city !== undefined) { params.push(city); conditions.push(`city = $${params.length}`); }
  if (isActive !== undefined) { params.push(isActive); conditions.push(`is_active = $${params.length}`); }

  const where = conditions.join(' AND ');
  params.push(limit); params.push(offset);

  const { rows } = await db.query(
    `SELECT id, name, city, phone, email, is_active, created_at
     FROM clinics WHERE ${where}
     ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cParams = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM clinics WHERE ${where}`, cParams);
  return { rows, total: parseInt(cr[0].count, 10) };
}

/**
 * Update clinic details.
 */
async function updateClinic(id, fields) {
  const allowed = ['name','address_line1','address_line2','city','state','postal_code','country','phone','email','website','description','logo_url'];
  const sets = [];
  const params = [];

  for (const [key, val] of Object.entries(fields)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.includes(col) && val !== undefined) {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return getClinicById(id);

  params.push(id);
  const { rows } = await db.query(
    `UPDATE clinics SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`,
    params
  );
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * Get clinic operating hours.
 */
async function getOperatingHours(clinicId) {
  const { rows } = await db.query(
    'SELECT * FROM clinic_hours WHERE clinic_id=$1 ORDER BY day_of_week',
    [clinicId]
  );
  return rows;
}

/**
 * Set/replace all operating hours for a clinic.
 */
async function setOperatingHours(clinicId, hoursArray) {
  return db.withTransaction(async (client) => {
    await client.query('DELETE FROM clinic_hours WHERE clinic_id=$1', [clinicId]);
    for (const h of hoursArray) {
      await client.query(
        'INSERT INTO clinic_hours (id, clinic_id, day_of_week, open_time, close_time, is_closed) VALUES ($1,$2,$3,$4,$5,$6)',
        [uuidv4(), clinicId, h.dayOfWeek, h.openTime, h.closeTime, h.isClosed || false]
      );
    }
  });
}

/**
 * Get clinic services (treatment types offered).
 */
async function getClinicServices(clinicId) {
  const { rows } = await db.query('SELECT * FROM clinic_services WHERE clinic_id=$1 AND is_active=true ORDER BY name', [clinicId]);
  return rows;
}

/**
 * Add a service to a clinic.
 */
async function addClinicService(clinicId, { name, description, durationMinutes, price, colorHex }) {
  const id = uuidv4();
  const { rows } = await db.query(
    'INSERT INTO clinic_services (id, clinic_id, name, description, duration_minutes, price, color_hex) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id, clinicId, name, description, durationMinutes, price, colorHex || '#4A90D9']
  );
  return rows[0];
}

/**
 * Update a clinic service.
 */
async function updateClinicService(serviceId, fields) {
  const { name, description, durationMinutes, price, colorHex, isActive } = fields;
  const { rows } = await db.query(
    `UPDATE clinic_services SET
       name=COALESCE($1,name), description=COALESCE($2,description),
       duration_minutes=COALESCE($3,duration_minutes), price=COALESCE($4,price),
       color_hex=COALESCE($5,color_hex), is_active=COALESCE($6,is_active), updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [name, description, durationMinutes, price, colorHex, isActive, serviceId]
  );
  if (!rows.length) throw Object.assign(new Error('Service not found'), { statusCode: 404 });
  return rows[0];
}

module.exports = { createClinic, getClinicById, listClinics, updateClinic, getOperatingHours, setOperatingHours, getClinicServices, addClinicService, updateClinicService };
