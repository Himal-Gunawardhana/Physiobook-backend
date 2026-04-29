'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

// PUT /messages/:id/read
router.put('/:id/read', ctrl.markRead);

module.exports = router;
