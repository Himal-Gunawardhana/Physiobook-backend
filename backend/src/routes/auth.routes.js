'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/auth.controller');
const { authenticate }          = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

const router = Router();

// POST /auth/register
router.post('/register', authLimiter, ctrl.register);

// GET  /auth/verify-email?token=
router.get('/verify-email', ctrl.verifyEmail);

// POST /auth/login
router.post('/login', authLimiter, ctrl.login);

// POST /auth/refresh  (cookie refreshToken)
router.post('/refresh', ctrl.refreshToken);

// POST /auth/logout  [auth]
router.post('/logout', authenticate, ctrl.logout);

// POST /auth/2fa/enable  [auth] → returns QR code
router.post('/2fa/enable', authenticate, ctrl.enable2fa);

// POST /auth/2fa/verify  — used for both login 2FA check AND setup confirmation
router.post('/2fa/verify', otpLimiter, ctrl.verify2fa);

// POST /auth/forgot-password
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);

// POST /auth/reset-password
router.post('/reset-password', ctrl.resetPassword);

module.exports = router;
