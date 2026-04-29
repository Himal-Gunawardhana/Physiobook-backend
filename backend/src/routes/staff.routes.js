'use strict';

const { Router }  = require('express');
const ctrl        = require('../controllers/staff.controller');
const { authenticate }         = require('../middleware/auth');
const { authorize, therapistOrAdmin } = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET  /staff/:sid/availability  [auth]
router.get('/:sid/availability', ctrl.getAvailability);

// PUT  /staff/:sid/availability  [clinic_admin or therapist]
router.put('/:sid/availability', therapistOrAdmin, ctrl.setAvailability);

module.exports = router;
