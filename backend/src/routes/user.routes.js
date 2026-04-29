'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/user.controller');
const { authenticate }   = require('../middleware/auth');
const { authorize }      = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET    /users/me
router.get('/me', ctrl.getMe);

// PUT    /users/me
router.put('/me', ctrl.updateMe);

// GET    /users/:id  [admin/superadmin]
router.get('/:id', authorize('clinic_admin', 'super_admin'), ctrl.getUserById);

// PUT    /users/:id/notif-prefs  [self or super_admin]
router.put('/:id/notif-prefs', ctrl.updateNotifPrefs);

// GET    /users/:id/notifications  [self]
router.get('/:id/notifications', ctrl.getNotifications);

// DELETE /users/:id  [super_admin]
router.delete('/:id', authorize('super_admin'), ctrl.deleteUser);

module.exports = router;
