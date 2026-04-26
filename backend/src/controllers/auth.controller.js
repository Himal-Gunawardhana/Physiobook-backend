'use strict';

const authService = require('../services/auth.service');
const R           = require('../utils/response');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return R.created(res, { message: 'Registration successful. Please check your email to verify your account.', userId: result.id });
  } catch (err) { next(err); }
}

async function verifyEmail(req, res, next) {
  try {
    await authService.verifyEmail(req.query.token);
    return R.success(res, { message: 'Email verified successfully. You can now log in.' });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    if (result.requiresTwoFa) {
      return R.success(res, { requiresTwoFa: true, partialToken: result.partialToken });
    }
    _setRefreshCookie(res, result.refreshToken);
    return R.success(res, { accessToken: result.accessToken, user: result.user });
  } catch (err) { next(err); }
}

async function verifyTwoFa(req, res, next) {
  try {
    const result = await authService.verifyTwoFa(req.body);
    _setRefreshCookie(res, result.refreshToken);
    return R.success(res, { accessToken: result.accessToken, user: result.user });
  } catch (err) { next(err); }
}

async function setupTwoFa(req, res, next) {
  try {
    const result = await authService.setupTwoFa(req.user.id);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function confirmTwoFa(req, res, next) {
  try {
    await authService.confirmTwoFa(req.user.id, req.body.code);
    return R.success(res, { message: '2FA enabled successfully' });
  } catch (err) { next(err); }
}

async function disableTwoFa(req, res, next) {
  try {
    await authService.disableTwoFa(req.user.id, req.body.code);
    return R.success(res, { message: '2FA disabled' });
  } catch (err) { next(err); }
}

async function refreshToken(req, res, next) {
  try {
    const token = req.cookies.refreshToken || req.headers['x-refresh-token'];
    if (!token) return R.unauthorised(res, 'No refresh token provided');
    const result = await authService.refreshToken(token);
    _setRefreshCookie(res, result.refreshToken);
    return R.success(res, { accessToken: result.accessToken });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'];
    await authService.logout(req.token, refreshToken);
    res.clearCookie('refreshToken');
    return R.noContent(res);
  } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
  try {
    await authService.forgotPassword(req.body.email);
    return R.success(res, { message: 'If this email exists, a password reset link has been sent.' });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body);
    return R.success(res, { message: 'Password reset successful. You can now log in.' });
  } catch (err) { next(err); }
}

function _setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
}

module.exports = { register, verifyEmail, login, verifyTwoFa, setupTwoFa, confirmTwoFa, disableTwoFa, refreshToken, logout, forgotPassword, resetPassword };
