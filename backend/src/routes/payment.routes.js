'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/payment.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();

// ── Stripe webhook — NO auth, raw body, signature-verified ────────────────
// NOTE: express.raw() middleware is applied in app.js for this exact path
router.post('/webhook', ctrl.stripeWebhook);

// All other payment routes require auth
router.use(authenticate);

// POST /payments/intent  — create a PaymentIntent
router.post('/intent',
  body('bookingId').isUUID(),
  body('amount').isFloat({ min: 0.01 }),
  body('currency').optional().isAlpha().isLength({ min: 3, max: 3 }),
  validate, ctrl.createPaymentIntent
);

// GET  /payments  — list payments
router.get('/', ctrl.listPayments);

// GET  /payments/revenue  — revenue summary (admin only)
router.get('/revenue',
  authorize('super_admin', 'clinic_admin'),
  query('dateFrom').optional().isDate(),
  query('dateTo').optional().isDate(),
  validate, ctrl.getRevenueSummary
);

// GET  /payments/:paymentId
router.get('/:paymentId',
  param('paymentId').isUUID(),
  validate, ctrl.getPayment
);

// POST /payments/:paymentId/refund  (admin only)
router.post('/:paymentId/refund',
  authorize('super_admin', 'clinic_admin'),
  param('paymentId').isUUID(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('reason').optional().isIn(['duplicate', 'fraudulent', 'requested_by_customer']),
  validate, ctrl.refundPayment
);

module.exports = router;
