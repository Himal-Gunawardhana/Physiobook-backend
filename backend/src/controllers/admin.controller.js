'use strict';

const adminService = require('../services/admin.service');
const R            = require('../utils/response');

async function getPlatformStats(req, res, next) {
  try {
    const stats = await adminService.getPlatformStats();
    return R.success(res, stats);
  } catch (err) { next(err); }
}

async function listAllClinics(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const result = await adminService.listAllClinics({ page, limit, search });
    return R.paginated(res, result.rows, { page: page || 1, limit: limit || 20, total: result.total });
  } catch (err) { next(err); }
}

async function setClinicActive(req, res, next) {
  try {
    const result = await adminService.setClinicActive(req.params.clinicId, req.body.isActive);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, actorId, entityType, action } = req.query;
    const logs = await adminService.getAuditLogs({ page, limit, actorId, entityType, action });
    return R.success(res, logs);
  } catch (err) { next(err); }
}

module.exports = { getPlatformStats, listAllClinics, setClinicActive, getAuditLogs };
