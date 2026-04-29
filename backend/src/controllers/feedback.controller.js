'use strict';

const svc = require('../services/feedback.service');
const R   = require('../utils/response');

async function createFeedback(req, res, next) {
  try {
    return R.created(res, await svc.createFeedback({ ...req.body, patientId: req.user.id }));
  } catch (err) { next(err); }
}

async function listFeedback(req, res, next) {
  try {
    const { clinicId, therapistId, page, limit } = req.query;
    const result = await svc.listFeedback({ clinicId, therapistId, page: +page || 1, limit: +limit || 20 });
    return R.paginated(res, result.rows, { total: result.total, page: +page || 1, limit: +limit || 20 }, { averageRating: result.averageRating });
  } catch (err) { next(err); }
}

async function getFeedback(req, res, next) {
  try { return R.success(res, await svc.getFeedbackById(req.params.id)); }
  catch (err) { next(err); }
}

module.exports = { createFeedback, listFeedback, getFeedback };
