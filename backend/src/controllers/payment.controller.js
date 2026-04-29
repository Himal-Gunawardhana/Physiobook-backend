'use strict';

const svc = require('../services/payment.service');
const R   = require('../utils/response');

async function createPayment(req, res, next) {
  try {
    const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
    const result = await svc.createPayment({ ...req.body, patientId });
    return R.created(res, result);
  } catch (err) { next(err); }
}

async function getPayment(req, res, next) {
  try { return R.success(res, await svc.getPaymentById(req.params.id)); }
  catch (err) { next(err); }
}

async function listPayments(req, res, next) {
  try {
    let { clinicId, status, from, to, page, limit } = req.query;
    if (req.user.role === 'clinic_admin') clinicId = req.user.clinicId;
    const result = await svc.listPayments({ clinicId, status, from, to, page: +page || 1, limit: +limit || 20 });
    return R.paginated(res, result.rows, { total: result.total, page: +page || 1, limit: +limit || 20 }, { totalRevenue: result.totalRevenue });
  } catch (err) { next(err); }
}

async function markPaid(req, res, next) {
  try { return R.success(res, await svc.markPaid(req.params.id)); }
  catch (err) { next(err); }
}

async function refundPayment(req, res, next) {
  try {
    const result = await svc.refundPayment(req.params.id, req.body);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function stripeWebhook(req, res, next) {
  try {
    const sig = req.headers['stripe-signature'];
    await svc.handleWebhook(req.body, sig);
    return res.json({ received: true });
  } catch (err) { next(err); }
}

async function exportPayments(req, res, next) {
  try {
    const { clinicId, from, to } = req.query;
    const rows = await svc.exportPayments({ clinicId: req.user.role === 'clinic_admin' ? req.user.clinicId : clinicId, from, to });

    const header = 'Reference,Amount,Currency,Method,Status,Paid At,Patient,Email,Service,Clinic\n';
    const csv    = header + rows.map((r) =>
      [r.booking_reference, r.amount, r.currency, r.method, r.status,
       r.paid_at || '', r.patient_name, r.patient_email, r.service_name, r.clinic_name]
        .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) { next(err); }
}

module.exports = { createPayment, getPayment, listPayments, markPaid, refundPayment, stripeWebhook, exportPayments };
