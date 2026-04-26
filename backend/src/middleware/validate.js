'use strict';

const { validationResult } = require('express-validator');
const R = require('../utils/response');

/**
 * Run after express-validator chains.
 * Returns 422 with field-level errors if validation fails.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return R.badRequest(res, 'Validation failed', errors.array());
  }
  next();
}

module.exports = validate;
