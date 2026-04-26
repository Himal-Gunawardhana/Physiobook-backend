'use strict';

const nodemailer = require('nodemailer');
const config     = require('./index');
const logger     = require('../utils/logger');

let transporter;

/**
 * PLACEHOLDER: Email transport.
 * Supports SMTP, SendGrid, or AWS SES.
 * Set EMAIL_PROVIDER in .env to switch providers.
 */
function getMailTransporter() {
  if (transporter) return transporter;

  switch (config.email.provider) {
    case 'sendgrid':
      // PLACEHOLDER: Replace SENDGRID_API_KEY in .env
      transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: { user: 'apikey', pass: config.email.sendgridApiKey },
      });
      break;

    case 'ses':
      // PLACEHOLDER: Replace AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SES_REGION in .env
      // Requires @aws-sdk/client-ses — install separately if using SES
      // transporter = nodemailer.createTransport({ SES: new SESClient({ region: ... }) });
      logger.warn('SES transport selected but aws-sdk/client-ses not bootstrapped. Falling back to SMTP.');
      // Fall through to SMTP by default here
      transporter = nodemailer.createTransport(config.email.smtp);
      break;

    case 'smtp':
    default:
      {
        const smtpOptions = {
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure
        };
        // Only add auth if user is provided (prevent empty auth errors with Mailhog)
        if (config.email.smtp.auth.user) {
          smtpOptions.auth = config.email.smtp.auth;
        }
        transporter = nodemailer.createTransport(smtpOptions);
      }
      break;
  }

  return transporter;
}

/**
 * Send an email.
 * @param {object} options - { to, subject, html, text }
 */
async function sendEmail({ to, subject, html, text }) {
  const transport = getMailTransporter();
  const info = await transport.sendMail({
    from:    config.email.from,
    to,
    subject,
    html,
    text,
  });
  logger.info(`Email sent to ${to} — messageId: ${info.messageId}`);
  return info;
}

module.exports = { sendEmail };
