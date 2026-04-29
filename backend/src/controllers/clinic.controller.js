'use strict';

const svc = require('../services/clinic.service');
const R   = require('../utils/response');

// ── Clinics ────────────────────────────────────────────────────────────────

async function listClinics(req, res, next) {
  try {
    const { page, limit, search, city } = req.query;
    const result = await svc.listClinics({ page: +page || 1, limit: +limit || 20, search, city });
    return R.paginated(res, result.rows, { total: result.total, page: +page || 1, limit: +limit || 20 });
  } catch (err) { next(err); }
}

async function createClinic(req, res, next) {
  try { return R.created(res, await svc.createClinic(req.body)); }
  catch (err) { next(err); }
}

async function getClinic(req, res, next) {
  try { return R.success(res, await svc.getClinicById(req.params.id)); }
  catch (err) { next(err); }
}

async function updateClinic(req, res, next) {
  try { return R.success(res, await svc.updateClinic(req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function getPortalConfig(req, res, next) {
  try { return R.success(res, await svc.getPortalConfig(req.params.id)); }
  catch (err) { next(err); }
}

async function updatePortalConfig(req, res, next) {
  try { return R.success(res, await svc.updatePortalConfig(req.params.id, req.body)); }
  catch (err) { next(err); }
}

// ── Services ──────────────────────────────────────────────────────────────

async function listServices(req, res, next) {
  try { return R.success(res, await svc.listServices(req.params.id)); }
  catch (err) { next(err); }
}

async function createService(req, res, next) {
  try { return R.created(res, await svc.createService(req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function updateService(req, res, next) {
  try { return R.success(res, await svc.updateService(req.params.id, req.params.sid, req.body)); }
  catch (err) { next(err); }
}

async function deleteService(req, res, next) {
  try { await svc.deleteService(req.params.id, req.params.sid); return R.noContent(res); }
  catch (err) { next(err); }
}

// ── Packages ──────────────────────────────────────────────────────────────

async function listPackages(req, res, next) {
  try { return R.success(res, await svc.listPackages(req.params.id)); }
  catch (err) { next(err); }
}

async function createPackage(req, res, next) {
  try { return R.created(res, await svc.createPackage(req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function updatePackage(req, res, next) {
  try { return R.success(res, await svc.updatePackage(req.params.id, req.params.pid, req.body)); }
  catch (err) { next(err); }
}

async function deletePackage(req, res, next) {
  try { await svc.deletePackage(req.params.id, req.params.pid); return R.noContent(res); }
  catch (err) { next(err); }
}

module.exports = {
  listClinics, createClinic, getClinic, updateClinic, getPortalConfig, updatePortalConfig,
  listServices, createService, updateService, deleteService,
  listPackages, createPackage, updatePackage, deletePackage,
};
