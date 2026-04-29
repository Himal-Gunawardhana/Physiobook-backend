'use strict';

/**
 * Standardised API response helpers.
 * All responses follow the spec envelope:
 *   Success:   { success: true, data: {...} }
 *   Error:     { success: false, error: { code, message, details? } }
 *   Paginated: { success: true, data: [...], meta: { total, page, limit, totalPages, ...extras } }
 */

function success(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function created(res, data = null) {
  return success(res, data, 201);
}

function noContent(res) {
  return res.status(204).send();
}

function paginated(res, rows, { page, limit, total }, extras = {}) {
  return res.status(200).json({
    success: true,
    data:    rows,
    meta: {
      page:       parseInt(page, 10),
      limit:      parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / Math.max(limit, 1)),
      ...extras,
    },
  });
}

// Error helpers — note: the global errorHandler is the primary error path.
// These are convenience shortcuts for known auth/access errors.
function _err(res, statusCode, code, message) {
  return res.status(statusCode).json({ success: false, error: { code, message } });
}

function badRequest(res, message = 'Bad request')           { return _err(res, 400, 'BAD_REQUEST', message); }
function unauthorised(res, message = 'Unauthorized')        { return _err(res, 401, 'UNAUTHORIZED', message); }
function forbidden(res, message = 'Forbidden')              { return _err(res, 403, 'FORBIDDEN', message); }
function notFound(res, message = 'Resource not found')      { return _err(res, 404, 'NOT_FOUND', message); }
function conflict(res, message = 'Conflict')                { return _err(res, 409, 'CONFLICT', message); }

module.exports = { success, created, noContent, paginated, badRequest, unauthorised, forbidden, notFound, conflict };
