'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/booking.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const router = Router();
router.use(authenticate);

// GET  /bookings/slots?therapistId=&date=&serviceDuration=
router.get('/slots',
  query('therapistId').isUUID(),
  query('date').isDate(),
  query('serviceDuration').isInt({ min: 5 }),
  validate, ctrl.getAvailableSlots
);

// GET  /bookings
router.get('/', ctrl.listBookings);

// POST /bookings
router.post('/',
  body('clinicId').isUUID(),
  body('therapistId').isUUID(),
  body('serviceId').isUUID(),
  body('appointmentDate').isDate(),
  body('startTime').matches(/^\d{2}:\d{2}$/),
  body('endTime').matches(/^\d{2}:\d{2}$/),
  validate, ctrl.createBooking
);

// GET  /bookings/:bookingId
router.get('/:bookingId',
  param('bookingId').isUUID(),
  validate, ctrl.getBooking
);

// PATCH /bookings/:bookingId/status
router.patch('/:bookingId/status',
  authorize('super_admin', 'clinic_admin', 'receptionist', 'therapist'),
  param('bookingId').isUUID(),
  body('status').isIn(['confirmed', 'cancelled', 'completed', 'no_show']),
  validate, ctrl.updateBookingStatus
);

// PUT  /bookings/:bookingId/reschedule
router.put('/:bookingId/reschedule',
  param('bookingId').isUUID(),
  body('appointmentDate').isDate(),
  body('startTime').matches(/^\d{2}:\d{2}$/),
  body('endTime').matches(/^\d{2}:\d{2}$/),
  validate, ctrl.rescheduleBooking
);

// POST /bookings/:bookingId/cancel
router.post('/:bookingId/cancel',
  param('bookingId').isUUID(),
  body('reason').optional().trim(),
  validate, ctrl.cancelBooking
);

module.exports = router;
