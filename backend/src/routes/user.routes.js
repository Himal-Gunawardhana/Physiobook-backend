'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const multer   = require('multer');
const config   = require('../config/index');
const ctrl     = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { authenticate }  = require('../middleware/auth');
const { authorize, selfOrAdmin } = require('../middleware/rbac');

const router  = Router();
// ── File upload — auto switches local disk ↔ AWS S3 based on NODE_ENV ──────
let upload;
if (config.env === 'production' && config.aws.s3Bucket) {
  // PRODUCTION: store in S3
  // Requires: npm install @aws-sdk/client-s3 multer-s3
  const { S3Client } = require('@aws-sdk/client-s3');
  const multerS3 = require('multer-s3');
  const s3Client = new S3Client({
    region:      config.aws.s3Region,
    credentials: { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey },
  });
  upload = multer({
    storage: multerS3({
      s3:          s3Client,
      bucket:      config.aws.s3Bucket,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => cb(null, `avatars/${req.user.id}-${Date.now()}-${file.originalname}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
      cb(null, true);
    },
  });
} else {
  // DEVELOPMENT: store on local disk in /uploads
  upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
      cb(null, true);
    },
  });
}

// All user routes require authentication
router.use(authenticate);

// GET  /users/me
router.get('/me', ctrl.getMe);

// PUT  /users/me
router.put('/me',
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isDate(),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  validate, ctrl.updateMe
);

// POST /users/me/avatar
router.post('/me/avatar', upload.single('avatar'), ctrl.uploadAvatar);

// PUT  /users/me/password
router.put('/me/password',
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  validate, ctrl.changePassword
);

// GET  /users  (admin only)
router.get('/', authorize('super_admin', 'clinic_admin', 'receptionist'), ctrl.listUsers);

// GET  /users/:id
router.get('/:id',
  param('id').isUUID(),
  validate, selfOrAdmin, ctrl.getUserById
);

// PATCH /users/:id/status  (admin only)
router.patch('/:id/status',
  authorize('super_admin', 'clinic_admin'),
  param('id').isUUID(),
  body('isActive').isBoolean(),
  validate, ctrl.setUserActive
);

// DELETE /users/:id  (admin only — soft delete)
router.delete('/:id',
  authorize('super_admin', 'clinic_admin'),
  param('id').isUUID(),
  validate, ctrl.deleteUser
);

module.exports = router;
