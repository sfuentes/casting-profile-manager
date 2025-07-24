import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { nanoid } from 'nanoid';
import {
  uploadProfilePhoto,
  uploadSetcardPhoto,
  deleteSetcardPhoto,
} from '../controllers/uploadController.js';
import { demoAuth } from '../middleware/auth.js';

const router = express.Router();

// Configure multer storage
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueId = nanoid(10);
    const fileExt = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${uniqueId}.${fileExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (process.env.MAX_FILE_SIZE || 10) * 1024 * 1024, // Default 10MB
  }
});

// All routes are protected
router.use(demoAuth);

router.post('/profile-photo', upload.single('photo'), uploadProfilePhoto);
router.post('/setcard-photo/:photoId', upload.single('photo'), uploadSetcardPhoto);
router.delete('/setcard-photo/:photoId', deleteSetcardPhoto);

export default router;
