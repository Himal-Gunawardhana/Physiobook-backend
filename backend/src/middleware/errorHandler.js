'use strict';

const logger = require('../utils/logger');

/**
 * Global error handler — must be the last middleware registered in app.js.
 * Standardizes all error responses to match frontend expectations:
 * {
 *   success: false,
 *   error: "ERROR_CODE",
 *   message: "User-friendly message"
 * }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack, path: req.path });

  // Express-validator validation errors
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors
    });
  }

  // PostgreSQL unique violation (duplicate key)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_RESOURCE',
      message: 'A record with this value already exists (e.g., email already registered)'
    });
  }

  // PostgreSQL foreign-key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist'
    });
  }

  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_ERROR',
      message: err.message || 'Payment processing failed'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Invalid or expired authentication token. Please login again.'
    });
  }

  // Multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: 'Uploaded file exceeds maximum size limit (5MB)'
    });
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS_ERROR',
      message: 'Your origin is not allowed to access this resource'
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode < 500
    ? (err.message || 'An error occurred')
    : 'An unexpected error occurred. Please try again later.';

  return res.status(statusCode).json({
    success: false,
    error: err.code || 'INTERNAL_ERROR',
    message: message
  });
}

module.exports = errorHandler;
