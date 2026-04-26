'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const ctrl     = require('../controllers/clinic.controller');
const validate = require('../middleware/validate');
const { authenticate }      = require('../middleware/auth');
const { authorize, scopeToClinic } = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET  /clinics  (public-ish — any authenticated user can browse)
router.get('/', ctrl.listClinics);

// POST /clinics  (super_admin only)
router.post('/',
  authorize('super_admin'),
  body('name').trim().notEmpty(),
  body('addressLine1').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('country').trim().notEmpty(),
  body('phone').isString().trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  validate, ctrl.createClinic
);

// GET  /clinics/:clinicId
router.get('/:clinicId',
  param('clinicId').isUUID(),
  validate, ctrl.getClinic
);

// PUT  /clinics/:clinicId
router.put('/:clinicId',
  authorize('super_admin', 'clinic_admin'),
  param('clinicId').isUUID(),
  validate, scopeToClinic, ctrl.updateClinic
);

// ── Operating hours ────────────────────────────────────────────────────────
// GET  /clinics/:clinicId/hours
router.get('/:clinicId/hours',
  param('clinicId').isUUID(),
  validate, ctrl.getOperatingHours
);

// PUT  /clinics/:clinicId/hours
router.put('/:clinicId/hours',
  authorize('super_admin', 'clinic_admin'),
  param('clinicId').isUUID(),
  body('hours').isArray({ min: 1 }),
  validate, scopeToClinic, ctrl.setOperatingHours
);

// ── Services (treatment catalogue) ────────────────────────────────────────
// GET  /clinics/:clinicId/services
router.get('/:clinicId/services',
  param('clinicId').isUUID(),
  validate, ctrl.getServices
);

// POST /clinics/:clinicId/services
router.post('/:clinicId/services',
  authorize('super_admin', 'clinic_admin'),
  param('clinicId').isUUID(),
  body('name').trim().notEmpty(),
  body('durationMinutes').isInt({ min: 5 }),
  body('price').isFloat({ min: 0 }),
  validate, scopeToClinic, ctrl.addService
);

// PUT  /clinics/:clinicId/services/:serviceId
router.put('/:clinicId/services/:serviceId',
  authorize('super_admin', 'clinic_admin'),
  param('clinicId').isUUID(),
  param('serviceId').isUUID(),
  validate, scopeToClinic, ctrl.updateService
);

module.exports = router;
