'use strict';

const commService = require('../services/communication.service');
const R           = require('../utils/response');

async function getOrCreateConversation(req, res, next) {
  try {
    const { therapistId } = req.body;
    const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
    const clinicId  = req.user.clinicId || req.body.clinicId;
    const convo = await commService.getOrCreateConversation(patientId, therapistId, clinicId);
    return R.success(res, convo);
  } catch (err) { next(err); }
}

async function listConversations(req, res, next) {
  try {
    const convos = await commService.listConversations(req.user.id, req.user.role);
    return R.success(res, convos);
  } catch (err) { next(err); }
}

async function getMessages(req, res, next) {
  try {
    const { page, limit } = req.query;
    const messages = await commService.getMessages(req.params.conversationId, { page, limit });
    // Mark as read
    await commService.markAsRead(req.params.conversationId, req.user.id);
    return R.success(res, messages);
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const msg = await commService.saveMessage({
      conversationId: req.params.conversationId,
      senderId:       req.user.id,
      body:           req.body.body,
      messageType:    req.body.messageType || 'text',
      fileUrl:        req.body.fileUrl,
    });
    return R.created(res, msg);
  } catch (err) { next(err); }
}

async function saveClinicalNote(req, res, next) {
  try {
    const note = await commService.saveClinicalNote({
      bookingId:       req.params.bookingId,
      therapistId:     req.user.id,
      subjectiveNote:  req.body.subjective,
      objectiveNote:   req.body.objective,
      assessmentNote:  req.body.assessment,
      planNote:        req.body.plan,
    });
    return R.success(res, note);
  } catch (err) { next(err); }
}

async function getClinicalNote(req, res, next) {
  try {
    const note = await commService.getClinicalNotes(req.params.bookingId);
    if (!note) return R.notFound(res, 'No clinical notes found for this booking');
    return R.success(res, note);
  } catch (err) { next(err); }
}

module.exports = { getOrCreateConversation, listConversations, getMessages, sendMessage, saveClinicalNote, getClinicalNote };
