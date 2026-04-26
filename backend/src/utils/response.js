'use strict';

/**
 * Standardised API response helpers.
 * All responses follow: { success, data?, error?, meta? }
 */

function success(res, data = null, statusCode = 200, meta = null) {
  const body = { success: true };
  if (data !== null) body.data   = data;
  if (meta !== null) body.meta   = meta;
  return res.status(statusCode).json(body);
}

function created(res, data = null) {
  return success(res, data, 201);
}

function noContent(res) {
  return res.status(204).send();
}

function error(res, message = 'Internal server error', statusCode = 500, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

function badRequest(res, message = 'Bad request', details = null) {
  return error(res, message, 400, details);
}

function unauthorised(res, message = 'Unauthorised') {
  return error(res, message, 401);
}

function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403);
}

function notFound(res, message = 'Resource not found') {
  return error(res, message, 404);
}

function conflict(res, message = 'Conflict') {
  return error(res, message, 409);
}

function paginated(res, rows, { page, limit, total }) {
  return success(res, rows, 200, {
    page:       parseInt(page, 10),
    limit:      parseInt(limit, 10),
    total,
    totalPages: Math.ceil(total / limit),
  });
}

module.exports = { success, created, noContent, error, badRequest, unauthorised, forbidden, notFound, conflict, paginated };
