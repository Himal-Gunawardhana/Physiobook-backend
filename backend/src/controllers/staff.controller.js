'use strict';

const staffService = require('../services/staff.service');
const R            = require('../utils/response');

async function createStaff(req, res, next) {
  try {
    const clinicId = req.user.role === 'super_admin' ? req.body.clinicId : req.user.clinicId;
    const result   = await staffService.createStaff({ ...req.body, clinicId });
    return R.created(res, { message: 'Staff member created. A welcome email with login details has been sent.', userId: result.userId });
  } catch (err) { next(err); }
}

async function listStaff(req, res, next) {
  try {
    const clinicId = req.user.role === 'super_admin' ? req.query.clinicId : req.user.clinicId;
    const { page, limit, role } = req.query;
    const result = await staffService.listStaff({ clinicId, role, page, limit });
    return R.paginated(res, result.rows, { page: page || 1, limit: limit || 20, total: result.total });
  } catch (err) { next(err); }
}

async function getTherapistProfile(req, res, next) {
  try {
    const profile = await staffService.getTherapistProfile(req.params.therapistId);
    return R.success(res, profile);
  } catch (err) { next(err); }
}

async function getAvailability(req, res, next) {
  try {
    const slots = await staffService.getAvailability(req.params.therapistId, req.query.date);
    return R.success(res, slots);
  } catch (err) { next(err); }
}

async function setWeeklySchedule(req, res, next) {
  try {
    const therapistId = req.params.therapistId || req.user.id;
    await staffService.setWeeklySchedule(therapistId, req.body.schedule);
    return R.success(res, { message: 'Weekly schedule updated' });
  } catch (err) { next(err); }
}

async function blockSlot(req, res, next) {
  try {
    const therapistId = req.params.therapistId || req.user.id;
    const result = await staffService.blockSlot(therapistId, req.body);
    return R.created(res, result);
  } catch (err) { next(err); }
}

async function listResources(req, res, next) {
  try {
    const clinicId = req.user.clinicId || req.query.clinicId;
    const resources = await staffService.listResources(clinicId);
    return R.success(res, resources);
  } catch (err) { next(err); }
}

async function createResource(req, res, next) {
  try {
    const clinicId = req.user.clinicId || req.body.clinicId;
    const resource = await staffService.createResource(clinicId, req.body);
    return R.created(res, resource);
  } catch (err) { next(err); }
}

module.exports = { createStaff, listStaff, getTherapistProfile, getAvailability, setWeeklySchedule, blockSlot, listResources, createResource };
