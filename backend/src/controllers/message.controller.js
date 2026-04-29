'use strict';

const svc = require('../services/message.service');
const R   = require('../utils/response');

async function getMessages(req, res, next) {
  try { return R.success(res, await svc.getMessages(req.params.bookingId, req.user.id)); }
  catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    return R.created(res, await svc.sendMessage(req.params.bookingId, req.user.id, req.body.content));
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try { return R.success(res, await svc.markRead(req.params.id, req.user.id)); }
  catch (err) { next(err); }
}

module.exports = { getMessages, sendMessage, markRead };
