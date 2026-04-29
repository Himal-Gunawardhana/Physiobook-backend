'use strict';

require('dotenv').config();

const config = {
  env:  process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  api: {
    version: process.env.API_VERSION || 'v1',
  },

  db: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    // RS256 — keys stored as base64 in env
    privateKey: process.env.JWT_PRIVATE_KEY
      ? Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8')
      : process.env.JWT_SECRET || 'dev-secret-change-in-production',
    publicKey: process.env.JWT_PUBLIC_KEY
      ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
      : process.env.JWT_SECRET || 'dev-secret-change-in-production',
    algorithm: process.env.JWT_PRIVATE_KEY ? 'RS256' : 'HS256',
    accessExpires:  process.env.JWT_ACCESS_EXPIRES  || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
    otpExpires: '10m',
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:5174')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs:  60 * 1000, // 1 minute
    max:       100,
    authMax:   10,
    otpMax:    5,
  },

  sendgrid: {
    apiKey:    process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'no-reply@physiobook.com',
    fromName:  'Physiobook',
  },

  smtp: {
    host:     process.env.SMTP_HOST     || 'smtp.sendgrid.net',
    port:     parseInt(process.env.SMTP_PORT, 10) || 587,
    user:     process.env.SMTP_USER     || 'apikey',
    pass:     process.env.SMTP_PASS     || process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'no-reply@physiobook.com',
    fromName:  'Physiobook',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken:  process.env.TWILIO_AUTH_TOKEN  || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },

  stripe: {
    secretKey:     process.env.STRIPE_SECRET_KEY     || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency:      'usd', // Stripe billing currency (LKR stored internally)
  },

  s3: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket:          process.env.AWS_S3_BUCKET         || 'physiobook-assets',
    region:          process.env.AWS_REGION            || 'ap-south-1',
    endpoint:        process.env.AWS_ENDPOINT          || '', // Cloudflare R2 endpoint
  },

  totp: {
    appName: 'Physiobook',
  },
};

module.exports = config;
