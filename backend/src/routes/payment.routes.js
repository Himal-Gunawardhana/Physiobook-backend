'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/payment.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize }                  = require('../middleware/rbac');

const router = Router();

// POST /payments/webhook  — raw body, no auth (Stripe webhook)
router.post('/webhook', ctrl.stripeWebhook);

// All routes below require auth
router.use(authenticate);

// GET  /payments/export  [clinic_admin, super_admin]
router.get('/export', authorize('clinic_admin', 'super_admin'), ctrl.exportPayments);

// GET  /payments  [clinic_admin, super_admin]
router.get('/', authorize('clinic_admin', 'super_admin'), ctrl.listPayments);

// POST /payments  [patient]
router.post('/', authorize('patient', 'clinic_admin', 'super_admin'), ctrl.createPayment);

// GET  /payments/:id  [auth]
router.get('/:id', ctrl.getPayment);

// PUT  /payments/:id/mark-paid  [clinic_admin]
router.put('/:id/mark-paid', authorize('clinic_admin', 'super_admin'), ctrl.markPaid);

// POST /payments/:id/refund  [patient or clinic_admin]
router.post('/:id/refund', ctrl.refundPayment);

module.exports = router;
