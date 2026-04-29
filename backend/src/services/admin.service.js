'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function getPlatformStats() {
  const [
    { rows: clinics },
    { rows: patients },
    { rows: bookings },
    { rows: revenue },
    { rows: monthlyBookings },
    { rows: monthlyRevenue },
    { rows: topClinics },
    { rows: recentSignups },
  ] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active FROM clinics`),
    db.query(`SELECT COUNT(*) FROM users WHERE role='patient'`),
    db.query(`SELECT COUNT(*) FROM bookings`),
    db.query(`SELECT SUM(amount) FROM payments WHERE status='paid'`),
    db.query(`SELECT COUNT(*) FROM bookings WHERE date_trunc('month', created_at)=date_trunc('month', NOW())`),
    db.query(`SELECT SUM(amount) FROM payments WHERE status='paid' AND date_trunc('month', paid_at)=date_trunc('month', NOW())`),
    db.query(`
      SELECT c.id, c.name,
             COUNT(b.id) AS booking_count,
             COALESCE(SUM(p.amount) FILTER (WHERE p.status='paid'), 0) AS revenue
      FROM clinics c
      LEFT JOIN bookings b ON b.clinic_id = c.id
      LEFT JOIN payments p ON p.clinic_id = c.id
      GROUP BY c.id, c.name
      ORDER BY revenue DESC LIMIT 5`),
    db.query(`SELECT id, first_name, last_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 10`),
  ]);

  return {
    totalClinics:      parseInt(clinics[0].total, 10),
    activeClinics:     parseInt(clinics[0].active, 10),
    totalPatients:     parseInt(patients[0].count, 10),
    totalBookings:     parseInt(bookings[0].count, 10),
    totalRevenue:      parseFloat(revenue[0].sum) || 0,
    bookingsThisMonth: parseInt(monthlyBookings[0].count, 10),
    revenueThisMonth:  parseFloat(monthlyRevenue[0].sum) || 0,
    topClinics,
    recentSignups,
  };
}

async function listAllClinics({ search, plan, isActive, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = []; const conds = ['1=1'];

  if (search)   { params.push(`%${search}%`); conds.push(`(c.name ILIKE $${params.length} OR c.email ILIKE $${params.length})`); }
  if (plan)     { params.push(plan);           conds.push(`c.subscription_plan=$${params.length}`); }
  if (isActive !== undefined) { params.push(isActive); conds.push(`c.is_active=$${params.length}`); }

  const where = conds.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT c.id, c.name, c.slug, c.city, c.email, c.phone, c.is_active,
            c.subscription_plan, c.created_at,
            COUNT(DISTINCT cs.id) AS staff_count,
            COUNT(DISTINCT b.id)  AS booking_count
     FROM clinics c
     LEFT JOIN clinic_staff cs ON cs.clinic_id = c.id
     LEFT JOIN bookings b ON b.clinic_id = c.id
     WHERE ${where}
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM clinics c WHERE ${where}`, cp);
  return { rows, total: parseInt(cr[0].count, 10) };
}

async function adminCreateClinic({ name, address, city, phone, email, ownerEmail, plan }) {
  // Find or create owner
  let owner = await db.query('SELECT id FROM users WHERE email=$1', [ownerEmail.toLowerCase()]);
  let ownerId;
  if (owner.rows.length) {
    ownerId = owner.rows[0].id;
  } else {
    const bcrypt = require('bcryptjs');
    const tempPw = `Clinic@${Math.floor(1000 + Math.random() * 9000)}`;
    const hash   = await bcrypt.hash(tempPw, 12);
    ownerId = uuidv4();
    await db.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash, role, is_email_verified, is_active)
       VALUES ($1,'Clinic','Admin',$2,$3,'clinic_admin',true,true)`,
      [ownerId, ownerEmail.toLowerCase(), hash]
    );
    owner = { tempPassword: tempPw };
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const clinicId = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO clinics (id, name, slug, address, city, phone, email, owner_id, subscription_plan, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
    [clinicId, name, slug, address, city, phone, email.toLowerCase(), ownerId, plan || 'free']
  );

  await db.query(
    `INSERT INTO clinic_subscriptions (id, clinic_id, plan, billing_cycle, price, is_active)
     VALUES ($1,$2,$3,'monthly',0,true)`,
    [uuidv4(), clinicId, plan || 'free']
  );

  return { clinic: rows[0], owner: { id: ownerId, email: ownerEmail, tempPassword: owner.tempPassword } };
}

async function adminUpdateClinic(id, data) {
  const fields = []; const vals = [];
  const allowedFields = { name: 'name', address: 'address', city: 'city', phone: 'phone', email: 'email', isActive: 'is_active' };
  for (const [key, col] of Object.entries(allowedFields)) {
    if (data[key] !== undefined) {
      fields.push(`${col}=$${fields.length + 1}`);
      vals.push(key === 'email' ? data[key].toLowerCase() : data[key]);
    }
  }
  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
  fields.push(`updated_at=NOW()`);
  vals.push(id);
  const { rows } = await db.query(`UPDATE clinics SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  return rows[0];
}

async function updateClinicPlan(clinicId, { plan, billingCycle }) {
  const PRICES = { free: 0, starter: 1999, pro: 4999, enterprise: 14999 };
  const price  = PRICES[plan] || 0;

  await db.query(`UPDATE clinics SET subscription_plan=$1, updated_at=NOW() WHERE id=$2`, [plan, clinicId]);
  await db.query(`UPDATE clinic_subscriptions SET is_active=false WHERE clinic_id=$1`, [clinicId]);
  const { rows } = await db.query(
    `INSERT INTO clinic_subscriptions (id, clinic_id, plan, billing_cycle, price, is_active)
     VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
    [uuidv4(), clinicId, plan, billingCycle || 'monthly', price]
  );
  return rows[0];
}

async function deleteClinic(id) {
  await db.query(`UPDATE clinics SET is_active=false, updated_at=NOW() WHERE id=$1`, [id]);
}

async function getAlerts() {
  const rows = [];
  const { rows: expiring } = await db.query(
    `SELECT cs.clinic_id, c.name AS clinic_name, cs.expires_at
     FROM clinic_subscriptions cs JOIN clinics c ON c.id=cs.clinic_id
     WHERE cs.is_active=true AND cs.expires_at IS NOT NULL AND cs.expires_at < NOW() + INTERVAL '7 days'`
  );
  for (const r of expiring) {
    rows.push({ type: 'subscription_expiring', message: `${r.clinic_name}'s subscription expires soon`, severity: 'warning', clinicId: r.clinic_id, createdAt: new Date() });
  }

  const { rows: noActivity } = await db.query(
    `SELECT c.id, c.name FROM clinics c WHERE c.is_active=true
     AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.clinic_id=c.id AND b.created_at>NOW()-INTERVAL '30 days')
     LIMIT 10`
  );
  for (const r of noActivity) {
    rows.push({ type: 'no_recent_bookings', message: `${r.name} has no bookings in the last 30 days`, severity: 'info', clinicId: r.id, createdAt: new Date() });
  }
  return rows;
}

async function listTickets({ status, priority, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = []; const conds = ['1=1'];
  if (status)   { params.push(status);   conds.push(`t.status=$${params.length}`); }
  if (priority) { params.push(priority); conds.push(`t.priority=$${params.length}`); }
  const where = conds.join(' AND ');
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT t.*, u.first_name || ' ' || u.last_name AS submitted_by_name, c.name AS clinic_name
     FROM support_tickets t
     JOIN users u ON u.id = t.submitted_by
     LEFT JOIN clinics c ON c.id = t.clinic_id
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM support_tickets t WHERE ${where}`, cp);
  return { rows, total: parseInt(cr[0].count, 10) };
}

async function createTicket({ submittedBy, clinicId, subject, description, priority }) {
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO support_tickets (id, submitted_by, clinic_id, subject, description, priority)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, submittedBy, clinicId || null, subject, description, priority || 'medium']
  );
  return rows[0];
}

async function updateTicket(id, { status, response }) {
  const fields = []; const vals = [];
  if (status   !== undefined) { fields.push(`status=$${fields.length+1}`);   vals.push(status); }
  if (response !== undefined) { fields.push(`response=$${fields.length+1}`); vals.push(response); }
  fields.push(`updated_at=NOW()`);
  vals.push(id);
  const { rows } = await db.query(`UPDATE support_tickets SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows.length) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  return rows[0];
}

async function listSubscriptions({ plan, isActive, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = []; const conds = ['1=1'];
  if (plan)     { params.push(plan);     conds.push(`cs.plan=$${params.length}`); }
  if (isActive !== undefined) { params.push(isActive); conds.push(`cs.is_active=$${params.length}`); }
  const where = conds.join(' AND ');
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT cs.*, c.name AS clinic_name FROM clinic_subscriptions cs JOIN clinics c ON c.id=cs.clinic_id
     WHERE ${where} ORDER BY cs.created_at DESC
     LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*) FROM clinic_subscriptions cs WHERE ${where}`, cp);
  return { rows, total: parseInt(cr[0].count, 10) };
}

module.exports = {
  getPlatformStats, listAllClinics, adminCreateClinic, adminUpdateClinic,
  updateClinicPlan, deleteClinic, getAlerts,
  listTickets, createTicket, updateTicket,
  listSubscriptions,
};
