'use strict';

const svc = require('../services/booking.service');
const R   = require('../utils/response');

async function createBooking(req, res, next) {
  try {
    const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
    const booking = await svc.createBooking({ ...req.body, patientId });
    return R.created(res, booking);
  } catch (err) { next(err); }
}

async function getBooking(req, res, next) {
  try {
    const booking = await svc.getBookingById(req.params.id);
    if (req.user.role === 'patient' && booking.patient_id !== req.user.id) return R.forbidden(res);
    if (req.user.role === 'clinic_admin' && booking.clinic_id !== req.user.clinicId) return R.forbidden(res);
    return R.success(res, booking);
  } catch (err) { next(err); }
}

async function listBookings(req, res, next) {
  try {
    let { clinicId, patientId, therapistId, status, date, page, limit } = req.query;
    if (req.user.role === 'patient')     patientId  = req.user.id;
    if (req.user.role === 'therapist')   therapistId = req.user.id;
    if (req.user.role === 'clinic_admin') clinicId = req.user.clinicId;

    const result = await svc.listBookings({ clinicId, patientId, therapistId, status, date, page: +page || 1, limit: +limit || 20 });
    return R.paginated(res, result.rows, { total: result.total, page: +page || 1, limit: +limit || 20 });
  } catch (err) { next(err); }
}

async function updateBookingStatus(req, res, next) {
  try {
    const booking = await svc.updateBookingStatus(req.params.id, req.body.status, req.user.id);
    return R.success(res, booking);
  } catch (err) { next(err); }
}

async function deleteBooking(req, res, next) {
  try {
    await svc.deleteBooking(req.params.id, req.user);
    return R.noContent(res);
  } catch (err) { next(err); }
}

async function autoAssign(req, res, next) {
  try {
    const result = await svc.autoAssign(req.body.bookingId);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function getAvailableSlots(req, res, next) {
  try {
    const { therapistId, clinicId, date, serviceDuration } = req.query;
    const slots = await svc.getAvailableSlots({ therapistId, clinicId, date, serviceDuration: parseInt(serviceDuration, 10) || 60 });
    return R.success(res, { slots });
  } catch (err) { next(err); }
}

module.exports = { createBooking, getBooking, listBookings, updateBookingStatus, deleteBooking, autoAssign, getAvailableSlots };
