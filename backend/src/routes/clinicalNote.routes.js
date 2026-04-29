'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/clinicalNote.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET  /clinical-notes/:patientId  [therapist or clinic_admin]
router.get('/:patientId', authorize('therapist', 'clinic_admin', 'super_admin'), ctrl.getNotes);

// POST /clinical-notes/:patientId  [therapist]
router.post('/:patientId', authorize('therapist'), ctrl.createNote);

// PUT  /clinical-notes/note/:noteId  [therapist (author only)]
router.put('/note/:noteId', authorize('therapist'), ctrl.updateNote);

module.exports = router;
