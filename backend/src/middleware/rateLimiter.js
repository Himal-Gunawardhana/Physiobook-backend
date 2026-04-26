'use strict';

const rateLimit = require('express-rate-limit');
const config    = require('../config/index');

const windowMs = config.rateLimit.windowMs;

/** General API rate limiter */
const apiLimiter = rateLimit({
  windowMs,
  max:     config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

/** Strict limiter for auth (login, register, reset password) */
const authLimiter = rateLimit({
  windowMs,
  max:     config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many authentication attempts. Please wait before trying again.' },
  skipSuccessfulRequests: true,
});

/** Very strict limiter for OTP / 2FA endpoints */
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max:      5,
  message: { success: false, error: 'Too many OTP attempts. Please wait 5 minutes.' },
});

module.exports = { apiLimiter, authLimiter, otpLimiter };
