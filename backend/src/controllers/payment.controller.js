'use strict';

const paymentService = require('../services/payment.service');
const R              = require('../utils/response');

async function createPaymentIntent(req, res, next) {
  try {
    const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
    const result = await paymentService.createPaymentIntent({ ...req.body, patientId });
    return R.created(res, result);
  } catch (err) { next(err); }
}

async function stripeWebhook(req, res, next) {
  try {
    // req.body is raw Buffer here (see app.js for raw body middleware on this path)
    const sig = req.headers['stripe-signature'];
    const result = await paymentService.handleWebhook(req.body, sig);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function refundPayment(req, res, next) {
  try {
    const result = await paymentService.refundPayment(req.params.paymentId, req.body);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function getPayment(req, res, next) {
  try {
    const payment = await paymentService.getPaymentById(req.params.paymentId);
    return R.success(res, payment);
  } catch (err) { next(err); }
}

async function listPayments(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const clinicId  = req.user.role !== 'super_admin' ? req.user.clinicId : req.query.clinicId;
    const patientId = req.user.role === 'patient'     ? req.user.id       : req.query.patientId;
    const result    = await paymentService.listPayments({ page, limit, clinicId, patientId, status });
    return R.paginated(res, result.rows, { page: page || 1, limit: limit || 20, total: result.total });
  } catch (err) { next(err); }
}

async function getRevenueSummary(req, res, next) {
  try {
    const clinicId = req.user.role !== 'super_admin' ? req.user.clinicId : req.query.clinicId;
    const { dateFrom = new Date(new Date().setDate(1)).toISOString().split('T')[0], dateTo = new Date().toISOString().split('T')[0] } = req.query;
    const summary = await paymentService.getRevenueSummary(clinicId, { dateFrom, dateTo });
    return R.success(res, summary);
  } catch (err) { next(err); }
}

module.exports = { createPaymentIntent, stripeWebhook, refundPayment, getPayment, listPayments, getRevenueSummary };
