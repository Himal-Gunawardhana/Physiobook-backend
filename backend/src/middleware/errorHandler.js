'use strict';

const logger = require('../utils/logger');

/**
 * Global error handler — must be the last middleware registered in app.js.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack, path: req.path });

  // Express-validator validation errors
  if (err.name === 'ValidationError') {
    return res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: 'A record with that value already exists' });
  }

  // PostgreSQL foreign-key violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, error: 'Referenced resource does not exist' });
  }

  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    return res.status(402).json({ success: false, error: err.message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  // Multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message    = statusCode < 500 ? err.message : 'Internal server error';

  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = errorHandler;
