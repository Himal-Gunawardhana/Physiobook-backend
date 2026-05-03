'use strict';

const config = require('../config');
const logger = require('./logger');

// ── Email provider selection ───────────────────────────────────────────────
// Priority: Resend → SendGrid (nodemailer) → Generic SMTP

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_NAME      = process.env.EMAIL_FROM_NAME  || 'Physiobook';
// For SMTP (including Zoho), use SMTP_USER as FROM if EMAIL_FROM not set
// Zoho requires FROM to match authenticated email
const FROM_ADDRESS   = process.env.EMAIL_FROM 
                      || (process.env.SMTP_USER && !RESEND_API_KEY ? process.env.SMTP_USER : null)
                      || config.sendgrid.fromEmail 
                      || 'onboarding@resend.dev';
const FROM           = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

// Lazy-load Resend client only if key is present
let _resend = null;
function getResend() {
  if (!_resend) {
    const { Resend } = require('resend');
    _resend = new Resend(RESEND_API_KEY);
  }
  return _resend;
}

// Nodemailer transporter (SendGrid or SMTP fallback)
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const nodemailer = require('nodemailer');
  if (config.sendgrid.apiKey) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: config.sendgrid.apiKey },
    });
  } else {
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return _transporter;
}

/**
 * Send a transactional email.
 * Uses Resend if RESEND_API_KEY is set, otherwise SendGrid/SMTP via nodemailer.
 * @param {Object} opts - { to, subject, html, text? }
 */
async function sendEmail({ to, subject, html, text }) {
  // ── Resend (preferred) ──────────────────────────────────────────
  if (RESEND_API_KEY) {
    try {
      const resend = getResend();
      const { data, error } = await resend.emails.send({
        from: FROM,
        to:   Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });
      if (error) {
        logger.error({ error, to, subject }, '[Email/Resend] Failed to send');
        return;
      }
      logger.info({ to, subject, id: data?.id }, '[Email/Resend] Sent');
      return data;
    } catch (err) {
      logger.error({ err, to, subject }, '[Email/Resend] Exception');
      return; // Don't throw — email failure should not break API
    }
  }

  // ── Nodemailer fallback (SendGrid SMTP / generic SMTP) ──────────
  if (!config.sendgrid.apiKey && !config.smtp.pass) {
    logger.warn({ to, subject }, '[Email] No email provider configured — skipping send');
    return;
  }
  try {
    const info = await getTransporter().sendMail({ from: FROM, to, subject, html, text });
    logger.info({ to, subject, messageId: info.messageId }, '[Email/SMTP] Sent');
    return info;
  } catch (err) {
    logger.error({ err, to, subject }, '[Email/SMTP] Failed to send');
  }
}

// ── Pre-built email templates ──────────────────────────────────────────────

function sendBookingConfirmation(to, { patientName, reference, date, time, serviceName, clinicName, therapistName, visitMode }) {
  return sendEmail({
    to,
    subject: `Booking Confirmed — ${reference} | Physiobook`,
    html: `
      <h2>Booking Confirmed ✅</h2>
      <p>Hi ${patientName},</p>
      <p>Your booking has been confirmed.</p>
      <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif">
        <tr><td><strong>Reference</strong></td><td>${reference}</td></tr>
        <tr><td><strong>Date</strong></td><td>${date}</td></tr>
        <tr><td><strong>Time</strong></td><td>${time}</td></tr>
        <tr><td><strong>Service</strong></td><td>${serviceName}</td></tr>
        <tr><td><strong>Therapist</strong></td><td>${therapistName}</td></tr>
        <tr><td><strong>Clinic</strong></td><td>${clinicName}</td></tr>
        <tr><td><strong>Visit Mode</strong></td><td>${visitMode}</td></tr>
      </table>
      <p>See you soon!</p>
      <p>— The Physiobook Team</p>
    `,
  });
}

function sendBookingCreatedNotification(to, { clinicAdminName, reference, patientName, date, time }) {
  return sendEmail({
    to,
    subject: `New Booking ${reference} | Physiobook`,
    html: `
      <h2>New Booking Request</h2>
      <p>Hi ${clinicAdminName},</p>
      <p>A new booking has been made by <strong>${patientName}</strong>.</p>
      <p>Reference: <strong>${reference}</strong><br/>Date: ${date} at ${time}</p>
      <p>Please log in to Physiobook to confirm or manage this booking.</p>
    `,
  });
}

function sendFeedbackPrompt(to, { patientName, reference, bookingId }) {
  return sendEmail({
    to,
    subject: `How was your session? Leave feedback | Physiobook`,
    html: `
      <h2>We'd love your feedback! ⭐</h2>
      <p>Hi ${patientName},</p>
      <p>Your session (${reference}) is now complete. Please take a moment to leave a review — it helps us improve!</p>
      <p><a href="https://physiobook.vercel.app/feedback/${bookingId}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Leave Feedback</a></p>
      <p>Thank you!</p>
    `,
  });
}

function sendPasswordReset(to, { name, resetUrl }) {
  return sendEmail({
    to,
    subject: 'Reset your Physiobook password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reset Password</a></p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });
}

function sendEmailVerification(to, { name, verifyUrl }) {
  return sendEmail({
    to,
    subject: 'Verify your Physiobook email',
    html: `
      <h2>Welcome to Physiobook!</h2>
      <p>Hi ${name}, please verify your email address to activate your account.</p>
      <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Verify Email</a></p>
    `,
  });
}

function sendStaffInvite(to, { inviteeName, clinicName, tempPassword, loginUrl }) {
  return sendEmail({
    to,
    subject: `You've been invited to join ${clinicName} on Physiobook`,
    html: `
      <h2>Welcome to ${clinicName} on Physiobook! 🎉</h2>
      <p>Hi ${inviteeName},</p>
      <p>You've been added as a staff member. Here are your login details:</p>
      <p><strong>Email:</strong> ${to}<br/><strong>Temporary Password:</strong> ${tempPassword}</p>
      <p><a href="${loginUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Login to Physiobook</a></p>
      <p>Please change your password after your first login.</p>
    `,
  });
}

function sendRefundReceipt(to, { patientName, reference, amount, currency, reason }) {
  return sendEmail({
    to,
    subject: `Refund Processed — ${reference} | Physiobook`,
    html: `
      <h2>Refund Processed 💳</h2>
      <p>Hi ${patientName},</p>
      <p>Your refund for booking <strong>${reference}</strong> has been processed.</p>
      <p><strong>Amount:</strong> ${currency} ${amount}</p>
      <p><strong>Reason:</strong> ${reason || 'N/A'}</p>
      <p>Please allow 3-5 business days for the amount to appear in your account.</p>
    `,
  });
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBookingCreatedNotification,
  sendFeedbackPrompt,
  sendPasswordReset,
  sendEmailVerification,
  sendStaffInvite,
  sendRefundReceipt,
};
