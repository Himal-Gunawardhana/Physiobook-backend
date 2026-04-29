'use strict';

const svc = require('../services/admin.service');
const R   = require('../utils/response');

async function getStats(req, res, next) {
  try { return R.success(res, await svc.getPlatformStats()); }
  catch (err) { next(err); }
}

async function listClinics(req, res, next) {
  try {
    const { search, plan, isActive, page, limit } = req.query;
    const result = await svc.listAllClinics({ search, plan, isActive: isActive !== undefined ? isActive === 'true' : undefined, page: +page || 1, limit: +limit || 20 });
    return R.paginated(res, result.rows, { total: result.total, page: +page || 1, limit: +limit || 20 });
  } catch (err) { next(err); }
}

async function createClinic(req, res, next) {
  try { return R.created(res, await svc.adminCreateClinic(req.body)); }
  catch (err) { next(err); }
}

async function updateClinic(req, res, next) {
  try { return R.success(res, await svc.adminUpdateClinic(req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function updateClinicPlan(req, res, next) {
  try { return R.success(res, await svc.updateClinicPlan(req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function deleteClinic(req, res, next) {
  try { await svc.deleteClinic(req.params.id); return R.noContent(res); }
  catch (err) { next(err); }
}

async function getAlerts(req, res, next) {
  try { return R.success(res, await svc.getAlerts()); }
  catch (err) { next(err); }
}

async function listTickets(req, res, next) {
  try {
    const result = await svc.listTickets({ ...req.query, page: +req.query.page || 1, limit: +req.query.limit || 20 });
    return R.paginated(res, result.rows, { total: result.total, page: +req.query.page || 1, limit: +req.query.limit || 20 });
  } catch (err) { next(err); }
}

async function createTicket(req, res, next) {
  try {
    return R.created(res, await svc.createTicket({ ...req.body, submittedBy: req.user.id, clinicId: req.user.clinicId || null }));
  } catch (err) { next(err); }
}

async function updateTicket(req, res, next) {
  try { return R.success(res, await svc.updateTicket(req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function listSubscriptions(req, res, next) {
  try {
    const result = await svc.listSubscriptions({ ...req.query, page: +req.query.page || 1, limit: +req.query.limit || 20 });
    return R.paginated(res, result.rows, { total: result.total, page: +req.query.page || 1, limit: +req.query.limit || 20 });
  } catch (err) { next(err); }
}

module.exports = {
  getStats, listClinics, createClinic, updateClinic, updateClinicPlan, deleteClinic,
  getAlerts, listTickets, createTicket, updateTicket, listSubscriptions,
};
