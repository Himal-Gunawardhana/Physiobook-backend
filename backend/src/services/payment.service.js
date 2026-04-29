'use strict';

const { v4: uuidv4 } = require('uuid');
const stripe   = require('../config/stripe');
const config   = require('../config');
const db       = require('../config/database');
const logger   = require('../utils/logger');
const { sendRefundReceipt } = require('../utils/sendEmail');

async function createPayment({ bookingId, patientId, method, stripePaymentMethodId }) {
  // Fetch booking + service price
  const { rows: bRows } = await db.query(
    `SELECT b.clinic_id, b.payment_status, s.price, s.currency
     FROM bookings b JOIN services s ON s.id = b.service_id WHERE b.id=$1`,
    [bookingId]
  );
  if (!bRows.length) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  const booking = bRows[0];
  if (booking.payment_status === 'paid') throw Object.assign(new Error('Booking already paid'), { statusCode: 409 });

  const id = uuidv4();
  let clientSecret = null;
  let stripeIntentId = null;

  if (method === 'card') {
    // Stripe charges in a supported currency — use USD equivalent for Stripe, store LKR internally
    const amountInCents = Math.round(parseFloat(booking.price) * 100);
    const intent = await stripe.paymentIntents.create({
      amount:   amountInCents,
      currency: config.stripe.currency, // 'usd' or configured currency
      payment_method: stripePaymentMethodId || undefined,
      metadata: { bookingId, patientId },
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    clientSecret  = intent.client_secret;
    stripeIntentId = intent.id;
  }

  const { rows } = await db.query(
    `INSERT INTO payments (id, booking_id, clinic_id, patient_id, amount, currency, method, status, stripe_payment_intent_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, bookingId, booking.clinic_id, patientId, booking.price, booking.currency,
     method, method === 'cash' ? 'pending' : 'pending', stripeIntentId]
  );

  // Update booking payment_status to 'partial' while Stripe processes
  await db.query(`UPDATE bookings SET payment_status='partial', updated_at=NOW() WHERE id=$1`, [bookingId]);

  return { payment: rows[0], clientSecret };
}

async function getPaymentById(id) {
  const { rows } = await db.query(
    `SELECT p.*, b.reference AS booking_reference, b.booked_date,
            u.first_name || ' ' || u.last_name AS patient_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN users u ON u.id = p.patient_id
     WHERE p.id=$1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  return rows[0];
}

async function listPayments({ page = 1, limit = 20, clinicId, status, from, to } = {}) {
  const offset = (page - 1) * limit;
  const params = []; const conds = ['1=1'];

  if (clinicId) { params.push(clinicId); conds.push(`p.clinic_id=$${params.length}`); }
  if (status)   { params.push(status);   conds.push(`p.status=$${params.length}`); }
  if (from)     { params.push(from);     conds.push(`p.created_at>=$${params.length}`); }
  if (to)       { params.push(to);       conds.push(`p.created_at<=$${params.length}`); }

  const where = conds.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.currency, p.method, p.status, p.paid_at, p.created_at,
            b.reference AS booking_reference, b.booked_date,
            u.first_name || ' ' || u.last_name AS patient_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN users u ON u.id = p.patient_id
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(`SELECT COUNT(*), SUM(p.amount) FILTER (WHERE p.status='paid') AS total_revenue FROM payments p WHERE ${where}`, cp);
  return {
    rows,
    total:        parseInt(cr[0].count, 10),
    totalRevenue: parseFloat(cr[0].total_revenue) || 0,
  };
}

async function markPaid(paymentId) {
  const { rows } = await db.query(
    `UPDATE payments SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
    [paymentId]
  );
  if (!rows.length) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  // Update booking payment status
  await db.query(`UPDATE bookings SET payment_status='paid', updated_at=NOW() WHERE id=$1`, [rows[0].booking_id]);
  return rows[0];
}

async function refundPayment(paymentId, { reason, amount }) {
  const { rows } = await db.query('SELECT * FROM payments WHERE id=$1', [paymentId]);
  if (!rows.length) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });

  const payment = rows[0];
  if (payment.status !== 'paid') throw Object.assign(new Error('Payment is not eligible for refund'), { statusCode: 400 });

  let stripeRefundId = null;
  if (payment.stripe_payment_intent_id) {
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: 'requested_by_customer',
    });
    stripeRefundId = refund.id;
  }

  const { rows: updated } = await db.query(
    `UPDATE payments SET status='refunded', refunded_at=NOW(), refund_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [reason || null, paymentId]
  );

  await db.query(`UPDATE bookings SET payment_status='refunded', updated_at=NOW() WHERE id=$1`, [payment.booking_id]);

  // Send refund receipt
  const { rows: patientRows } = await db.query(
    `SELECT u.email, u.first_name || ' ' || u.last_name AS name FROM users u WHERE u.id=$1`, [payment.patient_id]
  );
  const { rows: bookingRows } = await db.query('SELECT reference FROM bookings WHERE id=$1', [payment.booking_id]);
  if (patientRows[0]) {
    sendRefundReceipt(patientRows[0].email, {
      patientName: patientRows[0].name,
      reference:   bookingRows[0]?.reference,
      amount:      amount || payment.amount,
      currency:    payment.currency,
      reason,
    }).catch(() => {});
  }

  return updated[0];
}

async function handleWebhook(rawBody, sigHeader) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, config.stripe.webhookSecret);
  } catch (err) {
    logger.warn('[Stripe] Webhook signature failed:', err.message);
    throw Object.assign(new Error('Webhook signature verification failed'), { statusCode: 400 });
  }

  logger.info({ type: event.type }, '[Stripe] Webhook received');

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      await db.query(`UPDATE payments SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE stripe_payment_intent_id=$1`, [intent.id]);
      await db.query(
        `UPDATE bookings SET payment_status='paid', updated_at=NOW()
         WHERE id=(SELECT booking_id FROM payments WHERE stripe_payment_intent_id=$1)`,
        [intent.id]
      );
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      await db.query(`UPDATE payments SET status='failed', updated_at=NOW() WHERE stripe_payment_intent_id=$1`, [intent.id]);
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      await db.query(`UPDATE payments SET status='refunded', refunded_at=NOW(), updated_at=NOW() WHERE stripe_payment_intent_id=$1`, [charge.payment_intent]);
      break;
    }
    default:
      logger.debug({ type: event.type }, '[Stripe] Unhandled event');
  }

  return { received: true };
}

async function exportPayments({ clinicId, from, to }) {
  const params = []; const conds = ["p.status='paid'"];
  if (clinicId) { params.push(clinicId); conds.push(`p.clinic_id=$${params.length}`); }
  if (from)     { params.push(from);     conds.push(`p.paid_at>=$${params.length}`); }
  if (to)       { params.push(to);       conds.push(`p.paid_at<=$${params.length}`); }

  const { rows } = await db.query(
    `SELECT b.reference, p.amount, p.currency, p.method, p.status, p.paid_at,
            u.first_name || ' ' || u.last_name AS patient_name, u.email AS patient_email,
            s.name AS service_name, c.name AS clinic_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN users u ON u.id = p.patient_id
     JOIN services s ON s.id = b.service_id
     JOIN clinics c ON c.id = p.clinic_id
     WHERE ${conds.join(' AND ')}
     ORDER BY p.paid_at DESC`,
    params
  );
  return rows;
}

module.exports = {
  createPayment, getPaymentById, listPayments,
  markPaid, refundPayment, handleWebhook, exportPayments,
};
