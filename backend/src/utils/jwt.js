'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config');

const { privateKey, publicKey, algorithm, accessExpires, refreshExpires, otpExpires } = config.jwt;

/**
 * Sign an access token (15 min, RS256 or HS256).
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, privateKey, { algorithm, expiresIn: accessExpires });
}

/**
 * Sign a refresh token (7 days).
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, privateKey, { algorithm, expiresIn: refreshExpires });
}

/**
 * Sign a short-lived OTP / action token (verify-email, 2fa-pending, reset-password).
 */
function generateOtpToken(payload, expiresIn) {
  return jwt.sign(payload, privateKey, { algorithm, expiresIn: expiresIn || otpExpires });
}

/**
 * Verify an access token. Throws JsonWebTokenError / TokenExpiredError on failure.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, publicKey, { algorithms: [algorithm] });
}

/**
 * Verify a refresh token.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, publicKey, { algorithms: [algorithm] });
}

/**
 * Verify an OTP / action token.
 */
function verifyOtpToken(token) {
  return jwt.verify(token, publicKey, { algorithms: [algorithm] });
}

/**
 * Decode without verification (for logging/debugging only).
 */
function decode(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateOtpToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyOtpToken,
  decode,
};
