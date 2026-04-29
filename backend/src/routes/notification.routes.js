'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET  /notifications
router.get('/', ctrl.getNotifications);

// POST /notifications/send  [admin]
router.post('/send', authorize('super_admin', 'clinic_admin'), ctrl.sendNotification);

// PUT  /notifications/:id/read
router.put('/:id/read', ctrl.markRead);

module.exports = router;
