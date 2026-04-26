'use strict';

const bookingService = require('../services/booking.service');
const R              = require('../utils/response');

async function createBooking(req, res, next) {
  try {
    const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
    const booking = await bookingService.createBooking({ ...req.body, patientId });
    return R.created(res, booking);
  } catch (err) { next(err); }
}

async function getBooking(req, res, next) {
  try {
    const booking = await bookingService.getBookingById(req.params.bookingId);
    // Patients can only see their own bookings
    if (req.user.role === 'patient' && booking.patient_id !== req.user.id) return R.forbidden(res);
    return R.success(res, booking);
  } catch (err) { next(err); }
}

async function listBookings(req, res, next) {
  try {
    const { page, limit, status, date, dateFrom, dateTo, therapistId } = req.query;
    let { patientId, clinicId } = req.query;

    // Scope based on role
    if (req.user.role === 'patient')    patientId = req.user.id;
    if (req.user.role === 'therapist')  req.query.therapistId = req.user.id;
    if (req.user.role !== 'super_admin') clinicId = req.user.clinicId;

    const result = await bookingService.listBookings({ page, limit, clinicId, patientId, therapistId, status, date, dateFrom, dateTo });
    return R.paginated(res, result.rows, { page: page || 1, limit: limit || 20, total: result.total });
  } catch (err) { next(err); }
}

async function updateBookingStatus(req, res, next) {
  try {
    const booking = await bookingService.updateBookingStatus(req.params.bookingId, req.body.status, req.user.id);
    return R.success(res, booking);
  } catch (err) { next(err); }
}

async function rescheduleBooking(req, res, next) {
  try {
    const booking = await bookingService.rescheduleBooking(req.params.bookingId, { ...req.body, updatedById: req.user.id });
    return R.success(res, booking);
  } catch (err) { next(err); }
}

async function cancelBooking(req, res, next) {
  try {
    const booking = await bookingService.cancelBooking(req.params.bookingId, { ...req.body, cancelledById: req.user.id });
    return R.success(res, booking);
  } catch (err) { next(err); }
}

async function getAvailableSlots(req, res, next) {
  try {
    const { therapistId, date, serviceDuration } = req.query;
    const slots = await bookingService.getAvailableSlots({ therapistId, date, serviceDuration: parseInt(serviceDuration, 10) });
    return R.success(res, slots);
  } catch (err) { next(err); }
}

module.exports = { createBooking, getBooking, listBookings, updateBookingStatus, rescheduleBooking, cancelBooking, getAvailableSlots };
