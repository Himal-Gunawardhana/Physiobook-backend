'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/communication.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// ── Chat conversations ──────────────────────────────────────────────────────

// POST /communications/conversations  — get or create
router.post('/conversations',
  body('therapistId').isUUID(),
  validate, ctrl.getOrCreateConversation
);

// GET  /communications/conversations  — list mine
router.get('/conversations', ctrl.listConversations);

// GET  /communications/conversations/:conversationId/messages
router.get('/conversations/:conversationId/messages',
  param('conversationId').isUUID(),
  validate, ctrl.getMessages
);

// POST /communications/conversations/:conversationId/messages
router.post('/conversations/:conversationId/messages',
  param('conversationId').isUUID(),
  body('body').trim().notEmpty(),
  body('messageType').optional().isIn(['text', 'file', 'image']),
  validate, ctrl.sendMessage
);

// ── Clinical notes (SOAP) ──────────────────────────────────────────────────
// PUT  /communications/bookings/:bookingId/notes
router.put('/bookings/:bookingId/notes',
  authorize('therapist', 'clinic_admin', 'super_admin'),
  param('bookingId').isUUID(),
  body('subjective').optional().isString(),
  body('objective').optional().isString(),
  body('assessment').optional().isString(),
  body('plan').optional().isString(),
  validate, ctrl.saveClinicalNote
);

// GET  /communications/bookings/:bookingId/notes
router.get('/bookings/:bookingId/notes',
  authorize('therapist', 'clinic_admin', 'super_admin'),
  param('bookingId').isUUID(),
  validate, ctrl.getClinicalNote
);

module.exports = router;
