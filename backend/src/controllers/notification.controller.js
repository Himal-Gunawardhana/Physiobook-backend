'use strict';

const svc = require('../services/notification.service');
const R   = require('../utils/response');

async function getNotifications(req, res, next) {
  try {
    const result = await svc.getNotifications(req.user.id, req.query);
    return R.paginated(res, result.rows, { total: result.total, page: +req.query.page || 1, limit: +req.query.limit || 20 }, { unreadCount: result.unreadCount });
  } catch (err) { next(err); }
}

async function sendNotification(req, res, next) {
  try {
    const { userIds, message, channel, title } = req.body;
    const sent = await svc.sendBulkNotification({ userIds, title: title || 'Physiobook Notification', message, channel });
    return R.success(res, { sent });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await svc.markRead(req.params.id, req.user.id);
    return R.success(res, { read: true });
  } catch (err) { next(err); }
}

module.exports = { getNotifications, sendNotification, markRead };
