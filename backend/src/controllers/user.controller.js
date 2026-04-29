'use strict';

const svc = require('../services/user.service');
const R   = require('../utils/response');

async function getMe(req, res, next) {
  try { return R.success(res, await svc.getMe(req.user.id)); }
  catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const { firstName, lastName, phone, avatarUrl } = req.body;
    return R.success(res, await svc.updateMe(req.user.id, { firstName, lastName, phone, avatarUrl }));
  } catch (err) { next(err); }
}

async function getUserById(req, res, next) {
  try { return R.success(res, await svc.getUserById(req.params.id)); }
  catch (err) { next(err); }
}

async function updateNotifPrefs(req, res, next) {
  try {
    const userId = req.params.id === 'me' ? req.user.id : req.params.id;
    if (req.user.role !== 'super_admin' && userId !== req.user.id) return R.forbidden(res);
    return R.success(res, await svc.updateNotifPrefs(userId, req.body));
  } catch (err) { next(err); }
}

async function getNotifications(req, res, next) {
  try {
    const userId = req.params.id === 'me' ? req.user.id : req.params.id;
    if (req.user.role !== 'super_admin' && userId !== req.user.id) return R.forbidden(res);
    const result = await svc.getNotifications(userId, req.query);
    return R.paginated(res, result.rows, { total: result.total, page: parseInt(req.query.page, 10) || 1, limit: parseInt(req.query.limit, 10) || 20 });
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    await svc.deleteUser(req.params.id);
    return R.noContent(res);
  } catch (err) { next(err); }
}

module.exports = { getMe, updateMe, getUserById, updateNotifPrefs, getNotifications, deleteUser };
