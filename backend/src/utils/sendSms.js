'use strict';

const config = require('../config');
const logger = require('./logger');

let twilioClient = null;

function getClient() {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    return null;
  }
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

/**
 * Send an SMS via Twilio.
 * @param {string} to - E.164 phone number (e.g., +94771234567)
 * @param {string} body - Message body
 */
async function sendSms(to, body) {
  const client = getClient();
  if (!client) {
    logger.warn({ to }, '[SMS] Twilio not configured — skipping SMS');
    return;
  }
  try {
    const msg = await client.messages.create({
      from: config.twilio.fromNumber,
      to,
      body,
    });
    logger.info({ to, sid: msg.sid }, '[SMS] Sent');
    return msg;
  } catch (err) {
    logger.error({ err, to }, '[SMS] Failed to send');
    // Don't throw — SMS failures should not break the API flow
  }
}

/**
 * Send a booking reminder SMS.
 */
function sendBookingReminder(phone, { reference, date, time, clinicName }) {
  const body = `Physiobook Reminder: Your appointment ${reference} at ${clinicName} is on ${date} at ${time}. Reply STOP to unsubscribe.`;
  return sendSms(phone, body);
}

/**
 * Send an OTP verification SMS.
 */
function sendOtp(phone, otp) {
  const body = `Your Physiobook verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  return sendSms(phone, body);
}

module.exports = { sendSms, sendBookingReminder, sendOtp };
