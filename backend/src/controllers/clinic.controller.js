'use strict';

const clinicService = require('../services/clinic.service');
const R             = require('../utils/response');

async function createClinic(req, res, next) {
  try {
    const clinic = await clinicService.createClinic(req.body);
    return R.created(res, clinic);
  } catch (err) { next(err); }
}

async function getClinic(req, res, next) {
  try {
    const clinic = await clinicService.getClinicById(req.params.clinicId);
    return R.success(res, clinic);
  } catch (err) { next(err); }
}

async function listClinics(req, res, next) {
  try {
    const { page, limit, search, city } = req.query;
    const result = await clinicService.listClinics({ page, limit, search, city });
    return R.paginated(res, result.rows, { page: page || 1, limit: limit || 20, total: result.total });
  } catch (err) { next(err); }
}

async function updateClinic(req, res, next) {
  try {
    const clinic = await clinicService.updateClinic(req.params.clinicId, req.body);
    return R.success(res, clinic);
  } catch (err) { next(err); }
}

async function getOperatingHours(req, res, next) {
  try {
    const hours = await clinicService.getOperatingHours(req.params.clinicId);
    return R.success(res, hours);
  } catch (err) { next(err); }
}

async function setOperatingHours(req, res, next) {
  try {
    await clinicService.setOperatingHours(req.params.clinicId, req.body.hours);
    return R.success(res, { message: 'Operating hours updated' });
  } catch (err) { next(err); }
}

async function getServices(req, res, next) {
  try {
    const services = await clinicService.getClinicServices(req.params.clinicId);
    return R.success(res, services);
  } catch (err) { next(err); }
}

async function addService(req, res, next) {
  try {
    const service = await clinicService.addClinicService(req.params.clinicId, req.body);
    return R.created(res, service);
  } catch (err) { next(err); }
}

async function updateService(req, res, next) {
  try {
    const service = await clinicService.updateClinicService(req.params.serviceId, req.body);
    return R.success(res, service);
  } catch (err) { next(err); }
}

module.exports = { createClinic, getClinic, listClinics, updateClinic, getOperatingHours, setOperatingHours, getServices, addService, updateService };
