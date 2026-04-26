'use strict';

const Stripe = require('stripe');
const config = require('./index');

/**
 * PLACEHOLDER: Stripe payment gateway client.
 * Replace STRIPE_SECRET_KEY in .env with your actual key from https://dashboard.stripe.com/apikeys
 */
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-06-20',
  typescript: false,
});

module.exports = stripe;
