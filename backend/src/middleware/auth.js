'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { exists }            = require('../config/redis');
const R                     = require('../utils/response');

/**
 * Authenticate middleware — validates Bearer JWT.
 * Checks the token isn't blacklisted (logged out).
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return R.unauthorised(res, 'Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Check blacklist (logout / token revocation via Redis)
    const isBlacklisted = await exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return R.unauthorised(res, 'Token has been revoked. Please log in again.');
    }

    const decoded = verifyAccessToken(token);
    req.user  = decoded;   // { id, role, clinicId, email }
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return R.unauthorised(res, 'Access token expired');
    }
    return R.unauthorised(res, 'Invalid access token');
  }
}

/**
 * Optional authentication — attaches user if token present but doesn't block.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token    = authHeader.split(' ')[1];
      req.user       = verifyAccessToken(token);
      req.token      = token;
    }
  } catch (_) { /* ignore */ }
  next();
}

module.exports = { authenticate, optionalAuth };
