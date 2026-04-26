'use strict';

const R = require('../utils/response');

/**
 * Role-Based Access Control middleware factory.
 *
 * Roles hierarchy:
 *   super_admin > clinic_admin > receptionist | therapist > patient
 *
 * Usage:
 *   router.get('/admin/dashboard', authenticate, authorize('super_admin'), handler)
 *   router.get('/appointments', authenticate, authorize('receptionist', 'therapist', 'clinic_admin'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return R.unauthorised(res);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return R.forbidden(res, `Role '${req.user.role}' is not permitted to access this resource`);
    }
    next();
  };
}

/**
 * Scope guard — ensures the requesting user operates within their own clinic.
 * Attach after authenticate. Uses req.user.clinicId from JWT payload.
 *
 * Does NOT apply to super_admin (they bypass all clinic scoping).
 */
function scopeToClinic(req, res, next) {
  if (!req.user) return R.unauthorised(res);
  if (req.user.role === 'super_admin') return next(); // super_admin is global

  const routeClinicId = req.params.clinicId || req.body.clinicId;
  if (routeClinicId && routeClinicId !== req.user.clinicId) {
    return R.forbidden(res, 'You do not have access to this clinic');
  }
  next();
}

/**
 * Self-or-admin guard — a user can access their own resource, or an admin can access any.
 */
function selfOrAdmin(req, res, next) {
  if (!req.user) return R.unauthorised(res);
  const isAdmin = ['super_admin', 'clinic_admin'].includes(req.user.role);
  const isSelf  = req.params.id === req.user.id;
  if (!isAdmin && !isSelf) return R.forbidden(res);
  next();
}

module.exports = { authorize, scopeToClinic, selfOrAdmin };
