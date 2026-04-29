'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 }  = require('uuid');
const config          = require('../config');
const logger          = require('./logger');

let s3Client = null;

function getClient() {
  if (s3Client) return s3Client;
  const opts = {
    region: config.s3.region,
    credentials: {
      accessKeyId:     config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  };
  // Support Cloudflare R2 via custom endpoint
  if (config.s3.endpoint) {
    opts.endpoint  = config.s3.endpoint;
    opts.forcePathStyle = true;
  }
  s3Client = new S3Client(opts);
  return s3Client;
}

/**
 * Upload a buffer/stream to S3.
 * @param {Object} opts - { buffer, mimetype, folder, filename? }
 * @returns {string} Public URL of the uploaded object
 */
async function uploadFile({ buffer, mimetype, folder = 'uploads', filename }) {
  if (!config.s3.accessKeyId) {
    throw new Error('S3 not configured');
  }
  const key = `${folder}/${filename || uuidv4()}-${Date.now()}`;
  await getClient().send(new PutObjectCommand({
    Bucket:      config.s3.bucket,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype,
  }));
  const url = config.s3.endpoint
    ? `${config.s3.endpoint}/${config.s3.bucket}/${key}`
    : `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
  logger.info({ key, url }, '[S3] File uploaded');
  return url;
}

/**
 * Delete an object from S3.
 */
async function deleteFile(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
  logger.info({ key }, '[S3] File deleted');
}

/**
 * Generate a pre-signed URL for direct browser upload.
 * @param {Object} opts - { key, mimetype, expiresIn? }
 */
async function getPresignedUploadUrl({ key, mimetype, expiresIn = 300 }) {
  const command = new PutObjectCommand({
    Bucket:      config.s3.bucket,
    Key:         key,
    ContentType: mimetype,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

module.exports = { uploadFile, deleteFile, getPresignedUploadUrl };
