'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/feedback.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize }                  = require('../middleware/rbac');

const router = Router();

// GET  /feedback  (public)
router.get('/', optionalAuth, ctrl.listFeedback);

// GET  /feedback/:id  (public)
router.get('/:id', optionalAuth, ctrl.getFeedback);

// POST /feedback  [patient]
router.post('/', authenticate, authorize('patient'), ctrl.createFeedback);

module.exports = router;
