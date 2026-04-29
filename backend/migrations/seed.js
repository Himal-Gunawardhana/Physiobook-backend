'use strict';

/**
 * Physiobook — Full demo seed
 * Run: node migrations/seed.js
 * Passwords are bcrypt hashes of the demo passwords.
 */

const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding Physiobook demo data...\n');

    // ── 1. Users ──────────────────────────────────────────────────────────
    const SALT = 12;
    const hash = (pw) => bcrypt.hash(pw, SALT);

    const adminId    = uuidv4();
    const clinicAdId = uuidv4();
    const smith      = uuidv4();
    const allen      = uuidv4();
    const jones      = uuidv4();
    const patientId  = uuidv4();

    const users = [
      {
        id: adminId, first_name: 'Super', last_name: 'Admin',
        email: 'admin@physiobook.com', password: 'Admin@1234', role: 'super_admin',
      },
      {
        id: clinicAdId, first_name: 'Clinic', last_name: 'Admin',
        email: 'clinic@physiobook.com', password: 'Clinic@1234', role: 'clinic_admin',
      },
      {
        id: smith, first_name: 'Dr. Sarah', last_name: 'Smith',
        email: 'dr.smith@physiobook.com', password: 'Therapist@1234', role: 'therapist',
      },
      {
        id: allen, first_name: 'Dr. James', last_name: 'Allen',
        email: 'dr.allen@physiobook.com', password: 'Therapist@1234', role: 'therapist',
      },
      {
        id: jones, first_name: 'Dr. Priya', last_name: 'Jones',
        email: 'dr.jones@physiobook.com', password: 'Therapist@1234', role: 'therapist',
      },
      {
        id: patientId, first_name: 'Ashan', last_name: 'Perera',
        email: 'patient@physiobook.com', password: 'Patient@1234', role: 'patient',
      },
    ];

    for (const u of users) {
      const ph = await hash(u.password);
      await client.query(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, role, is_email_verified, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true,true)
         ON CONFLICT (email) DO NOTHING`,
        [u.id, u.first_name, u.last_name, u.email.toLowerCase(), ph, u.role]
      );
    }
    console.log('✅ Users seeded (6)');

    // ── 2. Clinics ────────────────────────────────────────────────────────
    const clinic1 = uuidv4();
    const clinic2 = uuidv4();

    const operatingHours = {
      0: { open: null,    close: null,    closed: true  }, // Sun
      1: { open: '08:00', close: '18:00', closed: false }, // Mon
      2: { open: '08:00', close: '18:00', closed: false }, // Tue
      3: { open: '08:00', close: '18:00', closed: false }, // Wed
      4: { open: '08:00', close: '18:00', closed: false }, // Thu
      5: { open: '08:00', close: '18:00', closed: false }, // Fri
      6: { open: '09:00', close: '13:00', closed: false }, // Sat
    };

    const clinics = [
      {
        id: clinic1, name: 'Elite Physio — Downtown', slug: 'elite-physio-downtown',
        address: '45 Galle Road, Colombo 03', city: 'Colombo',
        phone: '+94 11 234 5678', email: 'downtown@elitephysio.lk',
        subscription_plan: 'pro', owner_id: clinicAdId,
      },
      {
        id: clinic2, name: 'Elite Physio — North Branch', slug: 'elite-physio-north',
        address: '12 Kandy Road, Kelaniya', city: 'Kelaniya',
        phone: '+94 11 876 5432', email: 'north@elitephysio.lk',
        subscription_plan: 'starter', owner_id: clinicAdId,
      },
    ];

    for (const c of clinics) {
      await client.query(
        `INSERT INTO clinics (id, name, slug, address, city, phone, email, operating_hours, subscription_plan, owner_id, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
         ON CONFLICT (slug) DO NOTHING`,
        [c.id, c.name, c.slug, c.address, c.city, c.phone, c.email,
         JSON.stringify(operatingHours), c.subscription_plan, c.owner_id]
      );
    }
    console.log('✅ Clinics seeded (2)');

    // ── 3. Clinic Staff ───────────────────────────────────────────────────
    const csSmith  = uuidv4();
    const csAllen  = uuidv4();
    const csJones  = uuidv4();
    const csAdmin  = uuidv4();

    const staffMembers = [
      {
        id: csSmith, clinic_id: clinic1, user_id: smith,
        role_in_clinic: 'Senior Physiotherapist', specialization: 'Musculoskeletal & Sports',
        experience_years: 8, rating: 4.90, auto_rank: 'Senior', status: 'available',
      },
      {
        id: csAllen, clinic_id: clinic1, user_id: allen,
        role_in_clinic: 'Physiotherapist', specialization: 'Neuro Rehabilitation',
        experience_years: 5, rating: 4.75, auto_rank: 'Mid-Level', status: 'available',
      },
      {
        id: csJones, clinic_id: clinic1, user_id: jones,
        role_in_clinic: 'Physiotherapist', specialization: 'Women\'s Health & Pre/Post Natal',
        experience_years: 6, rating: 4.85, auto_rank: 'Senior', status: 'available',
      },
      {
        id: csAdmin, clinic_id: clinic1, user_id: clinicAdId,
        role_in_clinic: 'clinic_admin', specialization: null,
        experience_years: 0, rating: 0, auto_rank: null, status: 'available',
      },
    ];

    for (const s of staffMembers) {
      await client.query(
        `INSERT INTO clinic_staff (id, clinic_id, user_id, role_in_clinic, specialization, experience_years, rating, auto_rank, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (clinic_id, user_id) DO NOTHING`,
        [s.id, s.clinic_id, s.user_id, s.role_in_clinic, s.specialization,
         s.experience_years, s.rating, s.auto_rank, s.status]
      );
    }
    console.log('✅ Clinic staff seeded (4)');

    // ── 4. Staff Availability (Mon-Fri 9-17, Sat 9-13) ───────────────────
    const availStaff = [csSmith, csAllen, csJones];
    for (const sid of availStaff) {
      // Mon-Fri  (1-5)
      for (let d = 1; d <= 5; d++) {
        await client.query(
          `INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_active)
           VALUES ($1,$2,'09:00','17:00',true)
           ON CONFLICT (staff_id, day_of_week) DO NOTHING`,
          [sid, d]
        );
      }
      // Sat (6)
      await client.query(
        `INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1,6,'09:00','13:00',true)
         ON CONFLICT (staff_id, day_of_week) DO NOTHING`,
        [sid]
      );
    }
    console.log('✅ Staff availability seeded');

    // ── 5. Services ───────────────────────────────────────────────────────
    const svcList = [
      { name: 'Initial Assessment',        description: 'Comprehensive physiotherapy assessment and treatment plan.', duration: 60,  price: 3500 },
      { name: 'Short Wave Diathermy',      description: 'Deep heat therapy for joint and muscle pain relief.',        duration: 45,  price: 2800 },
      { name: 'Rehab Exercise Program',    description: 'Personalised rehabilitation exercise session.',              duration: 60,  price: 3000 },
      { name: 'Chest Physiotherapy',       description: 'Respiratory therapy techniques for chest conditions.',       duration: 60,  price: 4000 },
      { name: 'Pre-Natal Physiotherapy',   description: 'Safe prenatal care and pregnancy-related pain management.',  duration: 45,  price: 2500 },
      { name: 'Post-Natal Physiotherapy',  description: 'Postnatal recovery, pelvic floor, and body realignment.',   duration: 45,  price: 2500 },
      { name: 'Follow-up Session',         description: 'Progress review and continued treatment.',                   duration: 30,  price: 2200 },
    ];

    const svcIds = [];
    for (const s of svcList) {
      const id = uuidv4();
      svcIds.push(id);
      await client.query(
        `INSERT INTO services (id, clinic_id, name, description, duration_minutes, price, currency, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,'LKR',true)`,
        [id, clinic1, s.name, s.description, s.duration, s.price]
      );
    }
    console.log('✅ Services seeded (7)');

    // ── 6. Packages ───────────────────────────────────────────────────────
    const pkgList = [
      {
        name: 'Fast-Track Walk-in',
        description: 'Single walk-in session for quick consultations and minor complaints.',
        session_count: 1, price: 2200, discount: 0, is_fast_track: true,
      },
      {
        name: 'Post-Natal Full Recovery',
        description: '10-session comprehensive post-natal physiotherapy recovery programme.',
        session_count: 10, price: 21250, discount: 15, is_fast_track: false,
      },
    ];

    for (const p of pkgList) {
      await client.query(
        `INSERT INTO packages (id, clinic_id, name, description, session_count, price, discount_percent, is_fast_track, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [uuidv4(), clinic1, p.name, p.description, p.session_count, p.price, p.discount, p.is_fast_track]
      );
    }
    console.log('✅ Packages seeded (2)');

    // ── 7. Sample Bookings ────────────────────────────────────────────────
    const year = new Date().getFullYear();

    const bookingDefs = [
      {
        ref: `PB-${year}-0001`,
        patient_id: patientId, clinic_id: clinic1, therapist_id: csSmith,
        service_id: svcIds[0], visit_mode: 'clinic',
        booked_date: `${year}-05-12`, booked_time: '09:00', duration: 60,
        status: 'pending', payment_status: 'unpaid',
      },
      {
        ref: `PB-${year}-0002`,
        patient_id: patientId, clinic_id: clinic1, therapist_id: csAllen,
        service_id: svcIds[2], visit_mode: 'clinic',
        booked_date: `${year}-05-10`, booked_time: '11:00', duration: 60,
        status: 'confirmed', payment_status: 'paid',
      },
      {
        ref: `PB-${year}-0003`,
        patient_id: patientId, clinic_id: clinic1, therapist_id: csJones,
        service_id: svcIds[4], visit_mode: 'home',
        booked_date: `${year}-05-05`, booked_time: '10:00', duration: 45,
        status: 'completed', payment_status: 'paid',
      },
      {
        ref: `PB-${year}-0004`,
        patient_id: patientId, clinic_id: clinic1, therapist_id: csSmith,
        service_id: svcIds[6], visit_mode: 'online',
        booked_date: `${year}-05-01`, booked_time: '14:00', duration: 30,
        status: 'cancelled', payment_status: 'unpaid',
      },
    ];

    const bookingIds = [];
    for (const b of bookingDefs) {
      const id = uuidv4();
      bookingIds.push(id);
      await client.query(
        `INSERT INTO bookings
           (id, reference, clinic_id, patient_id, therapist_id, service_id, visit_mode,
            booked_date, booked_time, duration_minutes, status, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, b.ref, b.clinic_id, b.patient_id, b.therapist_id, b.service_id,
         b.visit_mode, b.booked_date, b.booked_time, b.duration,
         b.status, b.payment_status]
      );
    }
    console.log('✅ Sample bookings seeded (4)');

    // ── 8. Sample Payments (for confirmed/completed bookings) ─────────────
    const paidBookings = [
      { bookingIdx: 1, amount: 3000, method: 'card', status: 'paid', stripe_pi: 'pi_seed_test_001' },
      { bookingIdx: 2, amount: 2500, method: 'cash', status: 'paid', stripe_pi: null },
    ];

    for (const p of paidBookings) {
      const bId = bookingIds[p.bookingIdx];
      const { rows } = await client.query('SELECT clinic_id, patient_id FROM bookings WHERE id=$1', [bId]);
      await client.query(
        `INSERT INTO payments (id, booking_id, clinic_id, patient_id, amount, currency, method, status, stripe_payment_intent_id, paid_at)
         VALUES ($1,$2,$3,$4,$5,'LKR',$6,$7,$8,NOW())`,
        [uuidv4(), bId, rows[0].clinic_id, rows[0].patient_id, p.amount, p.method, p.status, p.stripe_pi]
      );
    }
    console.log('✅ Sample payments seeded');

    // ── 9. Sample Feedback (for completed booking) ─────────────────────
    const completedBooking = bookingIds[2];
    const { rows: fbRows } = await client.query(
      'SELECT therapist_id, clinic_id FROM bookings WHERE id=$1', [completedBooking]
    );
    await client.query(
      `INSERT INTO feedback (id, booking_id, patient_id, therapist_id, clinic_id, rating, comment, is_public)
       VALUES ($1,$2,$3,$4,$5,5,'Excellent service! Dr. Jones was very professional and helpful.',true)`,
      [uuidv4(), completedBooking, patientId, fbRows[0].therapist_id, fbRows[0].clinic_id]
    );
    console.log('✅ Sample feedback seeded');

    // ── 10. Clinic Subscriptions ──────────────────────────────────────────
    await client.query(
      `INSERT INTO clinic_subscriptions (id, clinic_id, plan, billing_cycle, price, starts_at, is_active)
       VALUES ($1,$2,'pro','monthly',4999,NOW(),true)`,
      [uuidv4(), clinic1]
    );
    await client.query(
      `INSERT INTO clinic_subscriptions (id, clinic_id, plan, billing_cycle, price, starts_at, is_active)
       VALUES ($1,$2,'starter','monthly',1999,NOW(),true)`,
      [uuidv4(), clinic2]
    );
    console.log('✅ Clinic subscriptions seeded');

    // ── 11. Booking sequence sync ─────────────────────────────────────────
    await client.query(`SELECT setval('booking_seq', 4)`);

    await client.query('COMMIT');
    console.log('\n🎉 Seed complete!\n');
    console.log('Demo Credentials:');
    console.log('  super_admin   → admin@physiobook.com    / Admin@1234');
    console.log('  clinic_admin  → clinic@physiobook.com   / Clinic@1234');
    console.log('  therapist     → dr.smith@physiobook.com / Therapist@1234');
    console.log('  therapist     → dr.allen@physiobook.com / Therapist@1234');
    console.log('  therapist     → dr.jones@physiobook.com / Therapist@1234');
    console.log('  patient       → patient@physiobook.com  / Patient@1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
