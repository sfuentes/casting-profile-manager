import fs from 'fs';
import path from 'path';
import Profile from '../models/Profile.js';
import { ApiError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

// @desc    Upload profile photo
// @route   POST /api/upload/profile-photo
// @access  Private
export const uploadProfilePhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError('Please upload a file', 400));
  }

  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ApiError('Profile not found', 404));
  }

  // If there was an old avatar, we might want to delete it from disk
  // But for now, let's just update the path
  const fileUrl = `/uploads/${req.file.filename}`;
  profile.avatar = fileUrl;
  profile.lastUpdated = new Date();

  await profile.save();

  res.status(200).json({
    success: true,
    data: {
      url: fileUrl
    }
  });
});

// @desc    Upload setcard photo
// @route   POST /api/upload/setcard-photo/:photoId
// @access  Private
export const uploadSetcardPhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError('Please upload a file', 400));
  }

  const { photoId } = req.params;
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ApiError('Profile not found', 404));
  }

  const fileUrl = `/uploads/${req.file.filename}`;

  // Find the photo in setcard.photos
  const photoIndex = profile.setcard.photos.findIndex((p) => p.id === photoId);

  if (photoIndex !== -1) {
    // Update existing photo slot
    profile.setcard.photos[photoIndex].url = fileUrl;
    profile.setcard.photos[photoIndex].uploadedAt = new Date();
  } else {
    // Add new photo slot if it doesn't exist (though usually they are pre-defined in this app)
    profile.setcard.photos.push({
      id: photoId,
      url: fileUrl,
      uploadedAt: new Date()
    });
  }

  profile.setcard.lastUpdated = new Date();
  profile.lastUpdated = new Date();

  await profile.save();

  res.status(200).json({
    success: true,
    data: {
      url: fileUrl
    }
  });
});

// @desc    Delete setcard photo
// @route   DELETE /api/upload/setcard-photo/:photoId
// @access  Private
export const deleteSetcardPhoto = asyncHandler(async (req, res, next) => {
  const { photoId } = req.params;
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    return next(new ApiError('Profile not found', 404));
  }

  const photoIndex = profile.setcard.photos.findIndex((p) => p.id === photoId);

  if (photoIndex === -1) {
    return next(new ApiError('Photo not found', 404));
  }

  // We set url to null instead of removing the object to keep the slot
  profile.setcard.photos[photoIndex].url = null;
  profile.setcard.lastUpdated = new Date();
  profile.lastUpdated = new Date();

  await profile.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});
