'use strict';

const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { totp } = require('otplib');
const QRCode  = require('qrcode');
const db      = require('../config/database');
const redis   = require('../config/redis');
const jwtUtil = require('../utils/jwt');
const config  = require('../config/index');
const notificationService = require('./notification.service');

/**
 * Register a new user (patient self-registration).
 */
async function register({ firstName, lastName, email, phone, password }) {
  // Check duplicate email
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const err = new Error('Email already registered'); err.statusCode = 409; throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  const verificationToken = jwtUtil.generateOtpToken({ id, action: 'verify-email' }, '24h');

  await db.query(
    `INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, is_email_verified)
     VALUES ($1,$2,$3,$4,$5,$6,'patient',false)`,
    [id, firstName, lastName, email, phone, passwordHash]
  );

  // PLACEHOLDER: Send verification email
  await notificationService.sendEmailVerification(email, firstName, verificationToken);

  return { id, email };
}

/**
 * Verify email address via token.
 */
async function verifyEmail(token) {
  const decoded = jwtUtil.verifyOtpToken(token);
  if (decoded.action !== 'verify-email') throw Object.assign(new Error('Invalid token'), { statusCode: 400 });

  const { rows } = await db.query('SELECT id, is_email_verified FROM users WHERE id=$1', [decoded.id]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (rows[0].is_email_verified) throw Object.assign(new Error('Email already verified'), { statusCode: 400 });

  await db.query('UPDATE users SET is_email_verified=true, updated_at=NOW() WHERE id=$1', [decoded.id]);
  return true;
}

/**
 * Login — returns tokens, or 2FA challenge if enabled.
 */
async function login({ email, password }) {
  const { rows } = await db.query(
    'SELECT id, first_name, email, password_hash, role, clinic_id, is_email_verified, two_fa_enabled, two_fa_secret, is_active FROM users WHERE email=$1',
    [email]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  if (!user.is_active) throw Object.assign(new Error('Account is deactivated'), { statusCode: 403 });
  if (!user.is_email_verified) throw Object.assign(new Error('Please verify your email first'), { statusCode: 403 });

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  // 2FA enabled — return partial session token
  if (user.two_fa_enabled) {
    const partialToken = jwtUtil.generateOtpToken({ id: user.id, action: '2fa-pending' }, '10m');
    return { requiresTwoFa: true, partialToken };
  }

  return _issueTokens(user);
}

/**
 * Verify TOTP code for 2FA login.
 */
async function verifyTwoFa({ partialToken, code }) {
  const decoded = jwtUtil.verifyOtpToken(partialToken);
  if (decoded.action !== '2fa-pending') throw Object.assign(new Error('Invalid 2FA token'), { statusCode: 400 });

  const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [decoded.id]);
  const user = rows[0];
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  // PLACEHOLDER: Verify TOTP code using otplib
  const isValid = totp.verify({ token: code, secret: user.two_fa_secret });
  if (!isValid) throw Object.assign(new Error('Invalid 2FA code'), { statusCode: 401 });

  return _issueTokens(user);
}

/**
 * Setup 2FA — generate secret and QR code for authenticator app.
 */
async function setupTwoFa(userId) {
  const { rows } = await db.query('SELECT email FROM users WHERE id=$1', [userId]);
  const user = rows[0];
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const secret  = totp.generateSecret();
  const otpauth = totp.keyuri(user.email, config.totp.appName, secret);
  const qrCode  = await QRCode.toDataURL(otpauth);

  // Store secret temporarily in Redis until confirmed
  await redis.set(`2fa_setup:${userId}`, secret, 300); // 5 min TTL

  return { secret, qrCode };
}

/**
 * Confirm and enable 2FA after user scans QR code.
 */
async function confirmTwoFa(userId, code) {
  const secret = await redis.get(`2fa_setup:${userId}`);
  if (!secret) throw Object.assign(new Error('2FA setup session expired. Please restart.'), { statusCode: 400 });

  const isValid = totp.verify({ token: code, secret });
  if (!isValid) throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 400 });

  await db.query('UPDATE users SET two_fa_enabled=true, two_fa_secret=$1, updated_at=NOW() WHERE id=$2', [secret, userId]);
  await redis.del(`2fa_setup:${userId}`);
  return true;
}

/**
 * Disable 2FA.
 */
async function disableTwoFa(userId, code) {
  const { rows } = await db.query('SELECT two_fa_secret FROM users WHERE id=$1', [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const isValid = totp.verify({ token: code, secret: rows[0].two_fa_secret });
  if (!isValid) throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 400 });

  await db.query('UPDATE users SET two_fa_enabled=false, two_fa_secret=NULL, updated_at=NOW() WHERE id=$1', [userId]);
  return true;
}

/**
 * Refresh access token using a valid refresh token.
 */
async function refreshToken(token) {
  const isRevoked = await redis.exists(`blacklist:${token}`);
  if (isRevoked) throw Object.assign(new Error('Refresh token revoked'), { statusCode: 401 });

  const decoded = jwtUtil.verifyRefreshToken(token);
  const { rows } = await db.query('SELECT id, email, role, clinic_id, is_active FROM users WHERE id=$1', [decoded.id]);
  const user = rows[0];
  if (!user || !user.is_active) throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });

  return _issueTokens(user);
}

/**
 * Logout — blacklist both tokens in Redis.
 */
async function logout(accessToken, refreshToken) {
  const decoded = jwtUtil.verifyAccessToken(accessToken);
  const ttl     = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) await redis.set(`blacklist:${accessToken}`, 1, ttl);
  if (refreshToken) await redis.set(`blacklist:${refreshToken}`, 1, 7 * 24 * 3600);
}

/**
 * Send forgot-password email.
 */
async function forgotPassword(email) {
  const { rows } = await db.query('SELECT id, first_name FROM users WHERE email=$1', [email]);
  if (!rows.length) return; // silently return — don't expose user existence

  const user  = rows[0];
  const token = jwtUtil.generateOtpToken({ id: user.id, action: 'reset-password' }, '1h');

  // PLACEHOLDER: Send reset email
  await notificationService.sendPasswordReset(email, user.first_name, token);
}

/**
 * Reset password using a valid reset token.
 */
async function resetPassword({ token, newPassword }) {
  const decoded = jwtUtil.verifyOtpToken(token);
  if (decoded.action !== 'reset-password') throw Object.assign(new Error('Invalid reset token'), { statusCode: 400 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { rowCount } = await db.query(
    'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
    [passwordHash, decoded.id]
  );
  if (!rowCount) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  // Invalidate all existing sessions by blocking the used reset token
  await redis.set(`blacklist:${token}`, 1, 3600);
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function _issueTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role, clinicId: user.clinic_id };
  const accessToken  = jwtUtil.generateAccessToken(payload);
  const refreshToken = jwtUtil.generateRefreshToken(payload);
  return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, name: user.first_name } };
}

module.exports = { register, verifyEmail, login, verifyTwoFa, setupTwoFa, confirmTwoFa, disableTwoFa, refreshToken, logout, forgotPassword, resetPassword };
