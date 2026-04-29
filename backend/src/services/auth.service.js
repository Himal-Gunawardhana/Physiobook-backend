'use strict';

const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { totp } = require('otplib');
const QRCode  = require('qrcode');
const db      = require('../config/database');
const redis   = require('../config/redis');
const jwtUtil = require('../utils/jwt');
const config  = require('../config');
const { sendEmailVerification, sendPasswordReset } = require('../utils/sendEmail');

async function register({ firstName, lastName, email, phone, password, role }) {
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    const err = new Error('Email already registered'); err.statusCode = 409; throw err;
  }

  const allowedSelfRegisterRoles = ['patient'];
  const userRole = allowedSelfRegisterRoles.includes(role) ? role : 'patient';

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  const verificationToken = jwtUtil.generateOtpToken({ id, action: 'verify-email' }, '24h');

  await db.query(
    `INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role, is_email_verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
    [id, firstName, lastName, email.toLowerCase(), phone || null, passwordHash, userRole]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'https://physiobook.vercel.app';
  await sendEmailVerification(email, {
    name: firstName,
    verifyUrl: `${frontendUrl}/verify-email?token=${verificationToken}`,
  });

  const accessToken  = jwtUtil.generateAccessToken({ id, email, role: userRole, clinicId: null });
  const refreshToken = jwtUtil.generateRefreshToken({ id, email, role: userRole, clinicId: null });
  await _storeRefreshToken(id, refreshToken);

  return {
    user: { id, email, role: userRole, firstName, lastName },
    accessToken,
    refreshToken,
  };
}

async function verifyEmail(token) {
  const decoded = jwtUtil.verifyOtpToken(token);
  if (decoded.action !== 'verify-email') throw Object.assign(new Error('Invalid token'), { statusCode: 400 });

  const { rows } = await db.query('SELECT id, is_email_verified FROM users WHERE id=$1', [decoded.id]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (rows[0].is_email_verified) return true;

  await db.query('UPDATE users SET is_email_verified=true, updated_at=NOW() WHERE id=$1', [decoded.id]);
  return true;
}

async function login({ email, password }) {
  const { rows } = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.role,
            u.is_email_verified, u.two_fa_enabled, u.two_fa_secret, u.is_active,
            cs.clinic_id AS clinic_id
     FROM users u
     LEFT JOIN clinic_staff cs ON cs.user_id = u.id AND u.role IN ('clinic_admin','therapist')
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  if (!user.is_active) throw Object.assign(new Error('Account is deactivated'), { statusCode: 403 });
  if (!user.is_email_verified) throw Object.assign(new Error('Please verify your email first'), { statusCode: 403 });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  await db.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);

  if (user.two_fa_enabled) {
    const partialToken = jwtUtil.generateOtpToken({ id: user.id, action: '2fa-pending' }, '10m');
    return { requiresTwoFa: true, partialToken };
  }

  return _issueTokens(user);
}

async function verifyTwoFa({ partialToken, code }) {
  const decoded = jwtUtil.verifyOtpToken(partialToken);
  if (decoded.action !== '2fa-pending') throw Object.assign(new Error('Invalid 2FA token'), { statusCode: 400 });

  const { rows } = await db.query(
    `SELECT u.*, cs.clinic_id FROM users u
     LEFT JOIN clinic_staff cs ON cs.user_id = u.id WHERE u.id=$1`, [decoded.id]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const isValid = totp.verify({ token: code, secret: user.two_fa_secret });
  if (!isValid) throw Object.assign(new Error('Invalid 2FA code'), { statusCode: 401 });

  return _issueTokens(user);
}

async function setupTwoFa(userId) {
  const { rows } = await db.query('SELECT email FROM users WHERE id=$1', [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const secret  = totp.generateSecret();
  const otpauth = totp.keyuri(rows[0].email, config.totp.appName, secret);
  const qrCode  = await QRCode.toDataURL(otpauth);

  await redis.set(`2fa_setup:${userId}`, secret, 'EX', 300);
  return { secret, qrCode };
}

async function confirmTwoFa(userId, code) {
  const secret = await redis.get(`2fa_setup:${userId}`);
  if (!secret) throw Object.assign(new Error('2FA setup expired. Please restart.'), { statusCode: 400 });

  const isValid = totp.verify({ token: code, secret });
  if (!isValid) throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 400 });

  await db.query('UPDATE users SET two_fa_enabled=true, two_fa_secret=$1, updated_at=NOW() WHERE id=$2', [secret, userId]);
  await redis.del(`2fa_setup:${userId}`);
  return true;
}

async function disableTwoFa(userId, code) {
  const { rows } = await db.query('SELECT two_fa_secret FROM users WHERE id=$1', [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const isValid = totp.verify({ token: code, secret: rows[0].two_fa_secret });
  if (!isValid) throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 400 });
  await db.query('UPDATE users SET two_fa_enabled=false, two_fa_secret=NULL, updated_at=NOW() WHERE id=$1', [userId]);
  return true;
}

async function refreshToken(token) {
  const isRevoked = await redis.exists(`blacklist:${token}`);
  if (isRevoked) throw Object.assign(new Error('Refresh token revoked'), { statusCode: 401 });

  const decoded = jwtUtil.verifyRefreshToken(token);
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.role, u.is_active, cs.clinic_id
     FROM users u
     LEFT JOIN clinic_staff cs ON cs.user_id = u.id
     WHERE u.id=$1`, [decoded.id]
  );
  const user = rows[0];
  if (!user || !user.is_active) throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });

  const newRefresh = jwtUtil.generateRefreshToken({ id: user.id, email: user.email, role: user.role, clinicId: user.clinic_id });
  await _storeRefreshToken(user.id, newRefresh);
  await redis.set(`blacklist:${token}`, 1, 'EX', 7 * 24 * 3600);

  return {
    accessToken:  jwtUtil.generateAccessToken({ id: user.id, email: user.email, role: user.role, clinicId: user.clinic_id }),
    refreshToken: newRefresh,
  };
}

async function logout(accessToken, refreshToken) {
  try {
    const decoded = jwtUtil.verifyAccessToken(accessToken);
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await redis.set(`blacklist:${accessToken}`, 1, 'EX', ttl);
  } catch (_) { /* expired is fine */ }
  if (refreshToken) await redis.set(`blacklist:${refreshToken}`, 1, 'EX', 7 * 24 * 3600);
}

async function forgotPassword(email) {
  const { rows } = await db.query('SELECT id, first_name FROM users WHERE email=$1', [email.toLowerCase()]);
  if (!rows.length) return;

  const user  = rows[0];
  const token = jwtUtil.generateOtpToken({ id: user.id, action: 'reset-password' }, '1h');
  const frontendUrl = process.env.FRONTEND_URL || 'https://physiobook.vercel.app';
  await sendPasswordReset(email, {
    name: user.first_name,
    resetUrl: `${frontendUrl}/reset-password?token=${token}`,
  });
}

async function resetPassword({ token, newPassword }) {
  const decoded = jwtUtil.verifyOtpToken(token);
  if (decoded.action !== 'reset-password') throw Object.assign(new Error('Invalid reset token'), { statusCode: 400 });

  const used = await redis.exists(`used_reset:${token}`);
  if (used) throw Object.assign(new Error('Reset token already used'), { statusCode: 400 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { rowCount } = await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [passwordHash, decoded.id]);
  if (!rowCount) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  await redis.set(`used_reset:${token}`, 1, 'EX', 3600);
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function _storeRefreshToken(userId, token) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)`,
    [uuidv4(), userId, hash, expiresAt]
  );
}

async function _issueTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role, clinicId: user.clinic_id || null };
  const accessToken  = jwtUtil.generateAccessToken(payload);
  const refreshToken = jwtUtil.generateRefreshToken(payload);
  await _storeRefreshToken(user.id, refreshToken);
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id, email: user.email, role: user.role,
      firstName: user.first_name, lastName: user.last_name,
      clinicId: user.clinic_id || null,
    },
  };
}

module.exports = {
  register, verifyEmail, login, verifyTwoFa, setupTwoFa, confirmTwoFa,
  disableTwoFa, refreshToken, logout, forgotPassword, resetPassword,
};
