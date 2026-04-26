'use strict';

const { Router } = require('express');
const { body, query } = require('express-validator');
const ctrl     = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

const router = Router();

// POST /auth/register
router.post('/register', authLimiter,
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and a number'),
  validate, ctrl.register
);

// GET /auth/verify-email?token=...
router.get('/verify-email', ctrl.verifyEmail);

// POST /auth/login
router.post('/login', authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate, ctrl.login
);

// POST /auth/2fa/verify
router.post('/2fa/verify', otpLimiter,
  body('partialToken').notEmpty(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('TOTP code must be 6 digits'),
  validate, ctrl.verifyTwoFa
);

// POST /auth/2fa/setup  (requires auth)
router.post('/2fa/setup', authenticate, ctrl.setupTwoFa);

// POST /auth/2fa/confirm
router.post('/2fa/confirm', authenticate,
  body('code').isLength({ min: 6, max: 6 }),
  validate, ctrl.confirmTwoFa
);

// DELETE /auth/2fa
router.delete('/2fa', authenticate,
  body('code').isLength({ min: 6, max: 6 }),
  validate, ctrl.disableTwoFa
);

// POST /auth/refresh
router.post('/refresh', ctrl.refreshToken);

// POST /auth/logout
router.post('/logout', authenticate, ctrl.logout);

// POST /auth/forgot-password
router.post('/forgot-password', authLimiter,
  body('email').isEmail().normalizeEmail(),
  validate, ctrl.forgotPassword
);

// POST /auth/reset-password
router.post('/reset-password',
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  validate, ctrl.resetPassword
);

module.exports = router;
