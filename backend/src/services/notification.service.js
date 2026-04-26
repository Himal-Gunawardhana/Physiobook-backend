'use strict';

const { sendEmail } = require('../config/mail');
const config        = require('../config/index');
const logger        = require('../utils/logger');

// ── PLACEHOLDER: Twilio SMS (install twilio package and uncomment)
// const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);

/**
 * Send email verification link to newly registered user.
 */
async function sendEmailVerification(email, firstName, token) {
  try {
    // For local testing, we point the link directly to the backend API to execute the verification
    const link = `http://localhost:${config.port}/api/v1/auth/verify-email?token=${token}`;
    await sendEmail({
      to:      email,
      subject: 'Verify your Physiobook account',
      html:    `
        <h2>Welcome to Physiobook, ${firstName}!</h2>
        <p>Please verify your email address by clicking the button below.</p>
        <a href="${link}" style="background:#4A90D9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        <p>If you did not create an account, please ignore this email.</p>
      `,
    });
  } catch (err) {
    logger.error(`Failed to send verification email to ${email}:`, err);
  }
}

/**
 * Send password reset link.
 */
async function sendPasswordReset(email, firstName, token) {
  const link = `${config.frontendUrl}/reset-password?token=${token}`;
  await sendEmail({
    to:      email,
    subject: 'Reset your Physiobook password',
    html:    `
      <h2>Password Reset Request</h2>
      <p>Hi ${firstName}, we received a request to reset your password.</p>
      <a href="${link}" style="background:#E74C3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, please ignore it.</p>
    `,
  });
}

/**
 * Send booking confirmation to patient (email + SMS placeholder).
 */
async function sendBookingConfirmation(patientId, booking) {
  try {
    // PLACEHOLDER: Fetch patient email/phone from DB if needed
    // For now this is triggered by bookingService which already has the patient data.
    logger.info(`[NOTIFICATION] Booking confirmation queued for booking ${booking.id}`);

    // PLACEHOLDER: SMS notification via Twilio
    // await twilio.messages.create({
    //   to:   patient.phone,
    //   from: config.twilio.phoneNumber,
    //   body: `Your Physiobook appointment (${booking.booking_ref}) is confirmed for ${booking.appointment_date} at ${booking.start_time}.`,
    // });
  } catch (err) {
    logger.error('sendBookingConfirmation failed:', err);
  }
}

/**
 * Send booking status change notification.
 */
async function sendBookingStatusUpdate(patientId, booking, status) {
  try {
    logger.info(`[NOTIFICATION] Booking ${booking.id} status changed to ${status}`);
    // PLACEHOLDER: Email / push notification
  } catch (err) {
    logger.error('sendBookingStatusUpdate failed:', err);
  }
}

/**
 * Send appointment reminder (called by a scheduler / cron job).
 * PLACEHOLDER: Wire this to a cron job (e.g., node-cron, AWS EventBridge).
 */
async function sendAppointmentReminder(appointment) {
  try {
    logger.info(`[NOTIFICATION] Reminder for appointment ${appointment.id}`);
    // PLACEHOLDER: Email reminder 24h and 1h before appointment
  } catch (err) {
    logger.error('sendAppointmentReminder failed:', err);
  }
}

/**
 * Send staff welcome email with temporary password.
 */
async function sendStaffWelcome(email, firstName, tempPassword) {
  try {
    await sendEmail({
      to:      email,
      subject: 'Welcome to Physiobook — Your Account Details',
      html:    `
        <h2>Welcome, ${firstName}!</h2>
        <p>Your Physiobook staff account has been created.</p>
        <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
        <p>Please log in and change your password immediately.</p>
        <a href="${config.frontendUrl}/login">Log in to Physiobook</a>
      `,
    });
  } catch (err) {
    logger.error(`Failed to send staff welcome email to ${email}:`, err);
  }
}

module.exports = { sendEmailVerification, sendPasswordReset, sendBookingConfirmation, sendBookingStatusUpdate, sendAppointmentReminder, sendStaffWelcome };
