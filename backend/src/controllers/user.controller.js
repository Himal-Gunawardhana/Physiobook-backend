'use strict';

const userService = require('../services/user.service');
const R           = require('../utils/response');

async function getMe(req, res, next) {
  try {
    const user = await userService.getUserById(req.user.id);
    return R.success(res, user);
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return R.success(res, user);
  } catch (err) { next(err); }
}

async function uploadAvatar(req, res, next) {
  try {
    // PLACEHOLDER: req.file.location is set by multer-s3 after S3 upload
    // Install @aws-sdk/client-s3 and multer-s3 to enable real S3 uploads
    const avatarUrl = req.file ? (req.file.location || `/uploads/${req.file.filename}`) : null;
    if (!avatarUrl) return R.badRequest(res, 'No file uploaded');
    const result = await userService.updateAvatar(req.user.id, avatarUrl);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    await userService.changePassword(req.user.id, req.body);
    return R.success(res, { message: 'Password changed successfully' });
  } catch (err) { next(err); }
}

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return R.success(res, user);
  } catch (err) { next(err); }
}

async function listUsers(req, res, next) {
  try {
    const { page, limit, role, search } = req.query;
    const clinicId = req.user.role !== 'super_admin' ? req.user.clinicId : req.query.clinicId;
    const result = await userService.listUsers({ page, limit, role, clinicId, search });
    return R.paginated(res, result.rows, { page: page || 1, limit: limit || 20, total: result.total });
  } catch (err) { next(err); }
}

async function setUserActive(req, res, next) {
  try {
    const result = await userService.setUserActive(req.params.id, req.body.isActive);
    return R.success(res, result);
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.params.id);
    return R.noContent(res);
  } catch (err) { next(err); }
}

module.exports = { getMe, updateMe, uploadAvatar, changePassword, getUserById, listUsers, setUserActive, deleteUser };
