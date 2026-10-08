const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/designs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Allowed file types filter (JPG, JPEG, PNG, WEBP, up to 5MB)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware to handle multipart form uploads safely or pass through non-multipart requests
const handleMultipartUpload = (req, res, next) => {
  // If not multipart, let normal body parsers handle it
  if (!req.is('multipart/form-data')) {
    return next();
  }

  upload.any()(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Photo must be 5MB or smaller.' });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.toLowerCase().includes('too large'))) {
        return res.status(400).json({ success: false, message: 'Photo must be 5MB or smaller.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = {
  upload,
  handleMultipartUpload
};
