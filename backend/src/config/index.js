'use strict';

/**
 * Central application configuration
 * All values sourced from environment variables.
 * Never hard-code secrets here.
 */
module.exports = {
  env:  process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,

  db: {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    },
  },

  redis: {
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls:      process.env.REDIS_TLS === 'true' ? {} : undefined,
  },

  jwt: {
    accessSecret:  process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn:  process.env.JWT_ACCESS_EXPIRES_IN  || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  stripe: {
    secretKey:      process.env.STRIPE_SECRET_KEY,
    webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET,
    currency:       process.env.STRIPE_CURRENCY || 'LKR',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    from:     `"${process.env.EMAIL_FROM_NAME || 'Physiobook'}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    smtp: {
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    },
    sendgridApiKey: process.env.SENDGRID_API_KEY,
  },

  twilio: {
    accountSid:  process.env.TWILIO_ACCOUNT_SID,
    authToken:   process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  aws: {
    accessKeyId:     process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    s3Bucket:        process.env.AWS_S3_BUCKET,
    s3Region:        process.env.AWS_S3_REGION || 'us-east-1',
  },

  totp: {
    appName: process.env.TOTP_APP_NAME || 'Physiobook',
  },

  rateLimit: {
    windowMs:    parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)     || 900000,
    max:         parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10)  || 100,
    authMax:     parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)      || 10,
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  logLevel:    process.env.LOG_LEVEL    || 'info',
};
