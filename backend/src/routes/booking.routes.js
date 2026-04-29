'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/booking.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize }                  = require('../middleware/rbac');

const router = Router();

// GET  /availability/slots  (public — needed for booking UI before login)
router.get('/slots', optionalAuth, ctrl.getAvailableSlots);

// All routes below require auth
router.use(authenticate);

// GET  /bookings
router.get('/', ctrl.listBookings);

// POST /bookings  [patient]
router.post('/', authorize('patient', 'clinic_admin', 'super_admin'), ctrl.createBooking);

// POST /bookings/auto-assign  [clinic_admin]
router.post('/auto-assign', authorize('clinic_admin', 'super_admin'), ctrl.autoAssign);

// GET  /bookings/:id
router.get('/:id', ctrl.getBooking);

// PUT  /bookings/:id/status  [clinic_admin, therapist]
router.put('/:id/status', authorize('clinic_admin', 'therapist', 'super_admin'), ctrl.updateBookingStatus);

// DELETE /bookings/:id  [patient (only pending) or clinic_admin]
router.delete('/:id', ctrl.deleteBooking);

module.exports = router;
