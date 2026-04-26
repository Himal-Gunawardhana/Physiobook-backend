'use strict';

const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = Router();

// Apply global rate limit to all API routes
router.use(apiLimiter);

// Mount domain routers
router.use('/auth',           require('./auth.routes'));
router.use('/users',          require('./user.routes'));
router.use('/clinics',        require('./clinic.routes'));
router.use('/staff',          require('./staff.routes'));
router.use('/bookings',       require('./booking.routes'));
router.use('/payments',       require('./payment.routes'));
router.use('/communications', require('./communication.routes'));
router.use('/admin',          require('./admin.routes'));

module.exports = router;
