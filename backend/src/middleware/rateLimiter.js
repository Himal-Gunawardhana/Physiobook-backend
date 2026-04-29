'use strict';

const { rateLimit }       = require('express-rate-limit');
const { RedisStore }      = require('rate-limit-redis');
const redis               = require('../config/redis');
const config              = require('../config');

function makeStore(prefix) {
  return new RedisStore({
    // rate-limit-redis v4: sendCommand receives { command: ['CMD', ...args] }
    sendCommand: ({ command }) => redis.call(command[0], ...command.slice(1)),
    prefix,
  });
}

/** Global API limiter — 100 req/min per IP */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders:   false,
  store: makeStore('rl:api:'),
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' } },
  skip: (req) => req.path === '/health',
});

/** Stricter limiter for auth endpoints — 10 req/min per IP */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  store: makeStore('rl:auth:'),
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many auth attempts. Please wait a minute.' } },
});

/** Even stricter for OTP/2FA — 5 req/min per IP */
const otpLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.otpMax,
  standardHeaders: true,
  legacyHeaders:   false,
  store: makeStore('rl:otp:'),
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many OTP attempts. Please wait.' } },
});

module.exports = { apiLimiter, authLimiter, otpLimiter };
