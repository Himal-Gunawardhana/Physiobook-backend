'use strict';

const { v4: uuidv4 } = require('uuid');
const stripe  = require('../config/stripe');
const config  = require('../config/index');
const db      = require('../config/database');
const logger  = require('../utils/logger');

/**
 * Create a Stripe PaymentIntent for a booking.
 * PLACEHOLDER: Replace STRIPE_SECRET_KEY in .env with your live/test key.
 */
async function createPaymentIntent({ bookingId, patientId, amount, currency }) {
  const curr = (currency || config.stripe.currency).toLowerCase();

  // Create PaymentIntent via Stripe
  // PLACEHOLDER: Stripe integration
  const intent = await stripe.paymentIntents.create({
    amount:   Math.round(amount * 100), // Stripe uses smallest currency unit
    currency: curr,
    metadata: { bookingId, patientId },
    automatic_payment_methods: { enabled: true },
  });

  // Record payment intent in DB
  const { rows } = await db.query(
    `INSERT INTO payments (id, booking_id, patient_id, amount, currency, stripe_payment_intent_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
    [uuidv4(), bookingId, patientId, amount, curr.toUpperCase(), intent.id]
  );

  return { clientSecret: intent.client_secret, paymentId: rows[0].id, amount, currency: curr };
}

/**
 * Handle Stripe webhook events.
 * The raw body is verified against STRIPE_WEBHOOK_SECRET.
 * PLACEHOLDER: Set STRIPE_WEBHOOK_SECRET in .env from Stripe dashboard.
 */
async function handleWebhook(rawBody, sigHeader) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, config.stripe.webhookSecret);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed:', err.message);
    throw Object.assign(new Error('Webhook signature verification failed'), { statusCode: 400 });
  }

  logger.info(`Stripe webhook event: ${event.type}`);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      await db.query(
        `UPDATE payments SET status='paid', paid_at=NOW(), updated_at=NOW()
         WHERE stripe_payment_intent_id=$1`,
        [intent.id]
      );
      await db.query(
        `UPDATE appointments SET status='confirmed', updated_at=NOW()
         WHERE id=(SELECT booking_id FROM payments WHERE stripe_payment_intent_id=$1)`,
        [intent.id]
      );
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      await db.query(
        `UPDATE payments SET status='failed', updated_at=NOW()
         WHERE stripe_payment_intent_id=$1`,
        [intent.id]
      );
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      await db.query(
        `UPDATE payments SET status='refunded', refunded_at=NOW(), updated_at=NOW()
         WHERE stripe_payment_intent_id=$1`,
        [charge.payment_intent]
      );
      break;
    }

    default:
      logger.debug(`Unhandled Stripe event: ${event.type}`);
  }

  return { received: true };
}

/**
 * Issue a refund for a payment.
 * PLACEHOLDER: Full or partial refund via Stripe.
 */
async function refundPayment(paymentId, { amount, reason }) {
  const { rows } = await db.query('SELECT * FROM payments WHERE id=$1', [paymentId]);
  if (!rows.length) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });

  const payment = rows[0];
  if (payment.status !== 'paid') throw Object.assign(new Error('Payment is not eligible for refund'), { statusCode: 400 });

  // PLACEHOLDER: Stripe refund
  const refundObj = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount:  amount ? Math.round(amount * 100) : undefined,
    reason:  reason || 'requested_by_customer',
  });

  await db.query(
    `UPDATE payments SET status='refunded', stripe_refund_id=$1, refund_reason=$2, refunded_at=NOW(), updated_at=NOW() WHERE id=$3`,
    [refundObj.id, reason, paymentId]
  );

  return { refundId: refundObj.id, status: refundObj.status };
}

/**
 * Get payment record by ID.
 */
async function getPaymentById(id) {
  const { rows } = await db.query(
    `SELECT p.*, a.booking_ref, u.first_name || ' ' || u.last_name AS patient_name
     FROM payments p
     JOIN appointments a ON a.id = p.booking_id
     JOIN users u ON u.id = p.patient_id
     WHERE p.id=$1`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  return rows[0];
}

/**
 * List payments with filters.
 */
async function listPayments({ page = 1, limit = 20, clinicId, patientId, status }) {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['1=1'];

  if (clinicId)  { params.push(clinicId);  conditions.push(`a.clinic_id=$${params.length}`); }
  if (patientId) { params.push(patientId); conditions.push(`p.patient_id=$${params.length}`); }
  if (status)    { params.push(status);    conditions.push(`p.status=$${params.length}`); }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.currency, p.status, p.paid_at, p.created_at,
            a.booking_ref, a.appointment_date,
            u.first_name || ' ' || u.last_name AS patient_name
     FROM payments p
     JOIN appointments a ON a.id = p.booking_id
     JOIN users u ON u.id = p.patient_id
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const cp = params.slice(0, params.length - 2);
  const { rows: cr } = await db.query(
    `SELECT COUNT(*) FROM payments p JOIN appointments a ON a.id=p.booking_id WHERE ${where}`,
    cp
  );
  return { rows, total: parseInt(cr[0].count, 10) };
}

/**
 * Revenue summary for a clinic within a date range.
 */
async function getRevenueSummary(clinicId, { dateFrom, dateTo }) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)                           AS total_transactions,
       SUM(p.amount)                      AS total_revenue,
       AVG(p.amount)                      AS avg_transaction,
       COUNT(*) FILTER (WHERE p.status='paid') AS paid_count,
       SUM(p.amount) FILTER (WHERE p.status='paid') AS paid_revenue
     FROM payments p
     JOIN appointments a ON a.id=p.booking_id
     WHERE a.clinic_id=$1 AND p.created_at BETWEEN $2 AND $3`,
    [clinicId, dateFrom, dateTo]
  );
  return rows[0];
}

module.exports = { createPaymentIntent, handleWebhook, refundPayment, getPaymentById, listPayments, getRevenueSummary };
