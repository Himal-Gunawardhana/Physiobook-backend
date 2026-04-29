'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config');

const {
  accessSecret, refreshSecret,
  privateKey, publicKey,
  algorithm, accessExpires, refreshExpires, otpExpires,
} = config.jwt;

// When RS256 keypair is present, use it; otherwise use separate HS256 secrets.
const accessSignKey   = privateKey  || accessSecret;
const accessVerifyKey = publicKey   || accessSecret;
const refreshSignKey  = privateKey  || refreshSecret;
const refreshVerifyKey = publicKey  || refreshSecret;
const otpSignKey      = privateKey  || accessSecret;
const otpVerifyKey    = publicKey   || accessSecret;

/**
 * Sign an access token (15 min).
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, accessSignKey, { algorithm, expiresIn: accessExpires });
}

/**
 * Sign a refresh token (7 days).
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, refreshSignKey, { algorithm, expiresIn: refreshExpires });
}

/**
 * Sign a short-lived OTP / action token (verify-email, 2fa-pending, reset-password).
 */
function generateOtpToken(payload, expiresIn) {
  return jwt.sign(payload, otpSignKey, { algorithm, expiresIn: expiresIn || otpExpires });
}

/**
 * Verify an access token. Throws JsonWebTokenError / TokenExpiredError on failure.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, accessVerifyKey, { algorithms: [algorithm] });
}

/**
 * Verify a refresh token.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, refreshVerifyKey, { algorithms: [algorithm] });
}

/**
 * Verify an OTP / action token.
 */
function verifyOtpToken(token) {
  return jwt.verify(token, otpVerifyKey, { algorithms: [algorithm] });
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
