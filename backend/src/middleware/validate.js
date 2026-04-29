'use strict';

const { z } = require('zod');

/**
 * Zod validation middleware factory.
 * Usage: validate(MyZodSchema)
 *
 * If schema is not provided, falls back to express-validator compatible behavior.
 */
function validate(schema) {
  if (!schema) {
    // Legacy compatibility: acts like the old validate.js with validationResult
    return (req, res, next) => {
      try {
        const { validationResult } = require('express-validator');
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const err = new Error('Validation failed');
          err.statusCode = 422;
          err.code = 'VALIDATION_ERROR';
          err.details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
          return next(err);
        }
        next();
      } catch (_) {
        next();
      }
    };
  }

  // Zod schema validation
  return (req, res, next) => {
    const result = schema.safeParse({
      body:   req.body,
      query:  req.query,
      params: req.params,
    });

    if (!result.success) {
      const err = new Error('Validation failed');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      err.details = result.error.errors.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      return next(err);
    }

    // Attach validated & coerced data
    req.body   = result.data.body   ?? req.body;
    req.query  = result.data.query  ?? req.query;
    req.params = result.data.params ?? req.params;
    next();
  };
}

module.exports = validate;
