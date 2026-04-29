'use strict';

const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = Router();

// Apply global rate limit
router.use(apiLimiter);

// ── Route mounts ──────────────────────────────────────────────────────────
router.use('/auth',              require('./auth.routes'));
router.use('/users',             require('./user.routes'));
router.use('/clinics',           require('./clinic.routes'));
router.use('/staff',             require('./staff.routes'));
router.use('/bookings',          require('./booking.routes'));
router.use('/availability',      require('./booking.routes'));   // /availability/slots re-uses booking router
router.use('/payments',          require('./payment.routes'));
router.use('/feedback',          require('./feedback.routes'));
router.use('/conversations',     require('./conversation.routes'));
router.use('/messages',          require('./message.routes'));
router.use('/clinical-notes',    require('./clinicalNote.routes'));
router.use('/notifications',     require('./notification.routes'));
router.use('/admin',             require('./admin.routes'));

module.exports = router;
