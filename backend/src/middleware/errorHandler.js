'use strict';

const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Maps known error shapes to the standard response envelope:
 *   { success: false, error: { code, message, details? } }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Already responded
  if (res.headersSent) return;

  const statusCode = err.statusCode || err.status || 500;
  const code       = err.code || _codeFromStatus(statusCode);
  const message    = err.message || 'An unexpected error occurred';
  const details    = err.details || undefined;

  // Don't log 4xx noise in detail, but do log 5xx
  if (statusCode >= 500) {
    logger.error({ err, req: { method: req.method, url: req.originalUrl, ip: req.ip } }, 'Internal server error');
  } else {
    logger.warn({ code, message, url: req.originalUrl }, 'Request error');
  }

  return res.status(statusCode).json({
    success: false,
    error: { code, message, ...(details && { details }) },
  });
}

function _codeFromStatus(status) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] || 'ERROR';
}

module.exports = errorHandler;
