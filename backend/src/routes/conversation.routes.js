'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

// GET  /conversations/:bookingId/messages
router.get('/:bookingId/messages', ctrl.getMessages);

// POST /conversations/:bookingId/messages
router.post('/:bookingId/messages', ctrl.sendMessage);

module.exports = router;
