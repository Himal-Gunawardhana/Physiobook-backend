'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/clinic.controller');
const staffCtrl  = require('../controllers/staff.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize, scopeToClinic }   = require('../middleware/rbac');

const router = Router();

// ── Clinics ────────────────────────────────────────────────────────────────

// GET  /clinics  (public)
router.get('/', optionalAuth, ctrl.listClinics);

// POST /clinics  [super_admin]
router.post('/', authenticate, authorize('super_admin'), ctrl.createClinic);

// GET  /clinics/:id  (public)
router.get('/:id', optionalAuth, ctrl.getClinic);

// PUT  /clinics/:id  [clinic_admin or super_admin]
router.put('/:id', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.updateClinic);

// GET  /clinics/:id/portal-config  [clinic_admin]
router.get('/:id/portal-config', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.getPortalConfig);

// PUT  /clinics/:id/portal-config  [clinic_admin]
router.put('/:id/portal-config', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.updatePortalConfig);

// ── Services ──────────────────────────────────────────────────────────────

// GET  /clinics/:id/services  (public)
router.get('/:id/services', optionalAuth, ctrl.listServices);

// POST /clinics/:id/services  [clinic_admin]
router.post('/:id/services', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.createService);

// PUT  /clinics/:id/services/:sid  [clinic_admin]
router.put('/:id/services/:sid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.updateService);

// DELETE /clinics/:id/services/:sid  [clinic_admin]
router.delete('/:id/services/:sid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.deleteService);

// ── Packages ──────────────────────────────────────────────────────────────

// GET  /clinics/:id/packages  (public)
router.get('/:id/packages', optionalAuth, ctrl.listPackages);

// POST /clinics/:id/packages  [clinic_admin]
router.post('/:id/packages', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.createPackage);

// PUT  /clinics/:id/packages/:pid  [clinic_admin]
router.put('/:id/packages/:pid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.updatePackage);

// DELETE /clinics/:id/packages/:pid  [clinic_admin]
router.delete('/:id/packages/:pid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, ctrl.deletePackage);

// ── Staff (under clinic) ──────────────────────────────────────────────────

// GET    /clinics/:clinicId/staff  [clinic_admin]
router.get('/:clinicId/staff', authenticate, authorize('clinic_admin', 'super_admin'), staffCtrl.listStaff);

// POST   /clinics/:clinicId/staff  [clinic_admin]
router.post('/:clinicId/staff', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, staffCtrl.addStaff);

// PUT    /clinics/:clinicId/staff/:sid  [clinic_admin]
router.put('/:clinicId/staff/:sid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, staffCtrl.updateStaff);

// DELETE /clinics/:clinicId/staff/:sid  [clinic_admin]
router.delete('/:clinicId/staff/:sid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, staffCtrl.removeStaff);

// ── Equipment ─────────────────────────────────────────────────────────────

// GET    /clinics/:clinicId/equipment  [clinic_admin]
router.get('/:clinicId/equipment', authenticate, authorize('clinic_admin', 'super_admin'), staffCtrl.listEquipment);

// POST   /clinics/:clinicId/equipment  [clinic_admin]
router.post('/:clinicId/equipment', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, staffCtrl.addEquipment);

// PUT    /clinics/:clinicId/equipment/:eid  [clinic_admin]
router.put('/:clinicId/equipment/:eid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, staffCtrl.updateEquipment);

// DELETE /clinics/:clinicId/equipment/:eid  [clinic_admin]
router.delete('/:clinicId/equipment/:eid', authenticate, authorize('clinic_admin', 'super_admin'), scopeToClinic, staffCtrl.deleteEquipment);

module.exports = router;
