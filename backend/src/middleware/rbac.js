'use strict';

const R = require('../utils/response');

/**
 * Role-based access guard factory.
 * Usage: authorize('super_admin', 'clinic_admin')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return R.unauthorised(res, 'Authentication required');
    if (!allowedRoles.includes(req.user.role)) {
      return R.forbidden(res, `Access denied. Requires role: ${allowedRoles.join(' | ')}`);
    }
    next();
  };
}

/**
 * Clinic scope guard — ensures clinic_admin can only access their own clinic.
 * Checks req.params.id or req.params.clinicId against req.user.clinicId.
 * Super admins bypass this check.
 */
function scopeToClinic(req, res, next) {
  if (!req.user) return R.unauthorised(res);
  if (req.user.role === 'super_admin') return next();

  const paramId = req.params.clinicId || req.params.id;
  if (paramId && req.user.clinicId && paramId !== req.user.clinicId) {
    return R.forbidden(res, 'Access restricted to your own clinic');
  }
  next();
}

/**
 * Self-or-admin guard — user can access their own resource or admin can access any.
 */
function selfOrAdmin(req, res, next) {
  if (!req.user) return R.unauthorised(res);
  const targetId = req.params.id || req.params.userId;
  if (req.user.role === 'super_admin' || req.user.role === 'clinic_admin') return next();
  if (targetId && targetId !== req.user.id) {
    return R.forbidden(res, 'Access denied');
  }
  next();
}

/**
 * Therapist-or-admin guard — therapist can only access their own data.
 */
function therapistOrAdmin(req, res, next) {
  if (!req.user) return R.unauthorised(res);
  if (['super_admin', 'clinic_admin'].includes(req.user.role)) return next();
  // For therapist, the request body/param staffId must match their own clinicStaffId
  // This is enforced at the service level for fine-grained checks
  if (req.user.role === 'therapist') return next();
  return R.forbidden(res, 'Access denied');
}

module.exports = { authorize, scopeToClinic, selfOrAdmin, therapistOrAdmin };
