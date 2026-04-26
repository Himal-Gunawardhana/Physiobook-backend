'use strict';

const { Router } = require('express');
const { param, body, query } = require('express-validator');
const ctrl     = require('../controllers/admin.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();

// All admin routes: must be authenticated + super_admin
router.use(authenticate, authorize('super_admin'));

// GET  /admin/stats
router.get('/stats', ctrl.getPlatformStats);

// GET  /admin/clinics
router.get('/clinics', ctrl.listAllClinics);

// PATCH /admin/clinics/:clinicId/status
router.patch('/clinics/:clinicId/status',
  param('clinicId').isUUID(),
  body('isActive').isBoolean(),
  validate, ctrl.setClinicActive
);

// GET  /admin/audit-logs
router.get('/audit-logs',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate, ctrl.getAuditLogs
);

module.exports = router;
