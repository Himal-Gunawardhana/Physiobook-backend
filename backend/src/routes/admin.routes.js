'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// All admin routes require super_admin EXCEPT ticket creation (any auth user)

// GET  /admin/stats
router.get('/stats', authorize('super_admin'), ctrl.getStats);

// GET  /admin/clinics
router.get('/clinics', authorize('super_admin'), ctrl.listClinics);

// POST /admin/clinics
router.post('/clinics', authorize('super_admin'), ctrl.createClinic);

// PUT  /admin/clinics/:id
router.put('/clinics/:id', authorize('super_admin'), ctrl.updateClinic);

// PUT  /admin/clinics/:id/plan
router.put('/clinics/:id/plan', authorize('super_admin'), ctrl.updateClinicPlan);

// DELETE /admin/clinics/:id
router.delete('/clinics/:id', authorize('super_admin'), ctrl.deleteClinic);

// GET  /admin/alerts
router.get('/alerts', authorize('super_admin'), ctrl.getAlerts);

// GET  /admin/tickets
router.get('/tickets', authorize('super_admin'), ctrl.listTickets);

// POST /admin/tickets  [any auth user]
router.post('/tickets', ctrl.createTicket);

// PUT  /admin/tickets/:id
router.put('/tickets/:id', authorize('super_admin'), ctrl.updateTicket);

// GET  /admin/subscriptions
router.get('/subscriptions', authorize('super_admin'), ctrl.listSubscriptions);

module.exports = router;
