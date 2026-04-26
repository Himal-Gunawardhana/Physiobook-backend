'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config/index');

/**
 * Generate an access token (short-lived).
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn:  config.jwt.accessExpiresIn,
    issuer:     'physiobook-api',
    audience:   'physiobook-client',
  });
}

/**
 * Generate a refresh token (long-lived).
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn:  config.jwt.refreshExpiresIn,
    issuer:     'physiobook-api',
    audience:   'physiobook-client',
  });
}

/**
 * Verify an access token. Returns the decoded payload or throws.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer:   'physiobook-api',
    audience: 'physiobook-client',
  });
}

/**
 * Verify a refresh token.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer:   'physiobook-api',
    audience: 'physiobook-client',
  });
}

/**
 * Generate a one-time signed token for email verification / password reset.
 * @param {object} payload - data to encode
 * @param {string} expiresIn - e.g. '1h', '24h'
 */
function generateOtpToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn });
}

function verifyOtpToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateOtpToken,
  verifyOtpToken,
};
