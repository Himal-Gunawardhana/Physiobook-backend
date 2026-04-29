'use strict';

const svc = require('../services/clinicalNote.service');
const db  = require('../config/database');
const R   = require('../utils/response');

async function getNotes(req, res, next) {
  try { return R.success(res, await svc.getNotes(req.params.patientId)); }
  catch (err) { next(err); }
}

async function createNote(req, res, next) {
  try {
    // Find therapist's clinic_staff id from req.user
    const { rows } = await db.query('SELECT id FROM clinic_staff WHERE user_id=$1', [req.user.id]);
    if (!rows.length) throw Object.assign(new Error('Therapist profile not found'), { statusCode: 403 });
    return R.created(res, await svc.createNote({
      ...req.body,
      patientId:        req.params.patientId,
      therapistStaffId: rows[0].id,
    }));
  } catch (err) { next(err); }
}

async function updateNote(req, res, next) {
  try {
    const { rows } = await db.query('SELECT id FROM clinic_staff WHERE user_id=$1', [req.user.id]);
    if (!rows.length) throw Object.assign(new Error('Therapist profile not found'), { statusCode: 403 });
    return R.success(res, await svc.updateNote(req.params.noteId, rows[0].id, req.body));
  } catch (err) { next(err); }
}

module.exports = { getNotes, createNote, updateNote };
