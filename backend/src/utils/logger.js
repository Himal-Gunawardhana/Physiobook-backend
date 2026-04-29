'use strict';

const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  ...(config.env !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  }),
  base: { service: 'physiobook-api', env: config.env },
});

module.exports = logger;
