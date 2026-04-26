'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/staff.controller');
const validate = require('../middleware/validate');
const { authenticate }      = require('../middleware/auth');
const { authorize, scopeToClinic } = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET  /staff  — list clinic staff
router.get('/', authorize('super_admin', 'clinic_admin', 'receptionist'), ctrl.listStaff);

// POST /staff  — create staff member (admin only)
router.post('/',
  authorize('super_admin', 'clinic_admin'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['therapist', 'receptionist', 'clinic_admin']),
  validate, ctrl.createStaff
);

// ── Therapist profile ──────────────────────────────────────────────────────
// GET  /staff/therapists/:therapistId
router.get('/therapists/:therapistId',
  param('therapistId').isUUID(),
  validate, ctrl.getTherapistProfile
);

// GET  /staff/therapists/:therapistId/availability?date=YYYY-MM-DD
router.get('/therapists/:therapistId/availability',
  param('therapistId').isUUID(),
  query('date').isDate(),
  validate, ctrl.getAvailability
);

// PUT  /staff/therapists/:therapistId/schedule  (therapist sets own schedule, admin can set for any)
router.put('/therapists/:therapistId/schedule',
  authorize('super_admin', 'clinic_admin', 'therapist'),
  param('therapistId').isUUID(),
  body('schedule').isArray({ min: 1 }),
  validate, ctrl.setWeeklySchedule
);

// POST /staff/therapists/:therapistId/block  (block a time slot)
router.post('/therapists/:therapistId/block',
  authorize('super_admin', 'clinic_admin', 'therapist'),
  param('therapistId').isUUID(),
  body('date').isDate(),
  body('startTime').matches(/^\d{2}:\d{2}$/),
  body('endTime').matches(/^\d{2}:\d{2}$/),
  validate, ctrl.blockSlot
);

// ── Resources (rooms / equipment) ─────────────────────────────────────────
// GET  /staff/resources
router.get('/resources', ctrl.listResources);

// POST /staff/resources
router.post('/resources',
  authorize('super_admin', 'clinic_admin'),
  body('name').trim().notEmpty(),
  body('type').isIn(['room', 'equipment', 'other']),
  validate, ctrl.createResource
);

module.exports = router;
