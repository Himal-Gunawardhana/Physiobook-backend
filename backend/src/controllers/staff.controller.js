'use strict';

const svc = require('../services/staff.service');
const R   = require('../utils/response');

async function listStaff(req, res, next) {
  try { return R.success(res, await svc.listStaff(req.params.clinicId)); }
  catch (err) { next(err); }
}

async function addStaff(req, res, next) {
  try { return R.created(res, await svc.addStaff(req.params.clinicId, req.body)); }
  catch (err) { next(err); }
}

async function updateStaff(req, res, next) {
  try { return R.success(res, await svc.updateStaff(req.params.clinicId, req.params.sid, req.body)); }
  catch (err) { next(err); }
}

async function removeStaff(req, res, next) {
  try { await svc.removeStaff(req.params.clinicId, req.params.sid); return R.noContent(res); }
  catch (err) { next(err); }
}

async function getAvailability(req, res, next) {
  try { return R.success(res, await svc.getAvailability(req.params.sid)); }
  catch (err) { next(err); }
}

async function setAvailability(req, res, next) {
  try { return R.success(res, await svc.setAvailability(req.params.sid, req.body.availability)); }
  catch (err) { next(err); }
}

async function listEquipment(req, res, next) {
  try { return R.success(res, await svc.listEquipment(req.params.clinicId)); }
  catch (err) { next(err); }
}

async function addEquipment(req, res, next) {
  try { return R.created(res, await svc.addEquipment(req.params.clinicId, req.body)); }
  catch (err) { next(err); }
}

async function updateEquipment(req, res, next) {
  try { return R.success(res, await svc.updateEquipment(req.params.clinicId, req.params.eid, req.body)); }
  catch (err) { next(err); }
}

async function deleteEquipment(req, res, next) {
  try { await svc.deleteEquipment(req.params.clinicId, req.params.eid); return R.noContent(res); }
  catch (err) { next(err); }
}

module.exports = {
  listStaff, addStaff, updateStaff, removeStaff,
  getAvailability, setAvailability,
  listEquipment, addEquipment, updateEquipment, deleteEquipment,
};
