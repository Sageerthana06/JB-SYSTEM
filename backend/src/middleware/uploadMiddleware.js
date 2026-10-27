const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 20 MB Limit per individual image
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB = 20,971,520 bytes
const SIZE_LIMIT_ERROR_MESSAGE = 'Image size must not exceed 20 MB.';

// Supported formats: JPG/JPEG, PNG, WebP, GIF, BMP
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
  'image/jpg'
];

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/designs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration with sanitized filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const uniqueName = `img-${Date.now()}-${randomHex}${safeExt}`;
    cb(null, uniqueName);
  }
});

// File filter checking extension and MIME type before write
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime);

  if (isExtAllowed && isMimeAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Supported formats: JPG, JPEG, PNG, WebP, GIF, and BMP.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // 20 MB limit
    files: 10 // Support multiple files if needed, each up to 20MB
  },
  fileFilter: fileFilter
});

/**
 * Validates the file signature / magic bytes of an uploaded image file.
 * Returns { valid: boolean, format?: string }
 */
const validateImageFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) {
      return { valid: false, error: SIZE_LIMIT_ERROR_MESSAGE, isSizeError: true };
    }
    if (stat.size < 12) {
      return { valid: false, error: 'File is too small to be a valid image' };
    }

    // Read the first 16 bytes for header signature inspection
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // 1. JPEG / JPG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true, format: 'jpeg' };
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
    ) {
      return { valid: true, format: 'png' };
    }

    // 3. GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
    if (
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
      buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
    ) {
      return { valid: true, format: 'gif' };
    }

    // 4. WebP: RIFF (52 49 46 46) at offset 0, and WEBP (57 45 42 50) at offset 8
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return { valid: true, format: 'webp' };
    }

    // 5. BMP: BM (42 4D) at offset 0
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return { valid: true, format: 'bmp' };
    }

    return { valid: false, error: 'Invalid image content. File signature does not match supported image formats.' };
  } catch (err) {
    return { valid: false, error: `Validation error: ${err.message}` };
  }
};

// Middleware to handle multipart form uploads safely or pass through non-multipart requests
const handleMultipartUpload = (req, res, next) => {
  // If not multipart, let normal body parsers handle it
  if (!req.is('multipart/form-data')) {
    return next();
  }

  upload.any()(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: SIZE_LIMIT_ERROR_MESSAGE });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.toLowerCase().includes('too large'))) {
        return res.status(400).json({ success: false, message: SIZE_LIMIT_ERROR_MESSAGE });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    // Validate uploaded files content & magic bytes
    const files = req.files || (req.file ? [req.file] : []);
    for (const f of files) {
      const validation = validateImageFile(f.path);
      if (!validation.valid) {
        // Clean up unsafe or invalid file immediately
        try { fs.unlinkSync(f.path); } catch (e) {}
        return res.status(400).json({
          success: false,
          message: validation.error || 'Invalid image content.'
        });
      }
    }

    next();
  });
};

module.exports = {
  upload,
  handleMultipartUpload,
  validateImageFile,
  MAX_FILE_SIZE,
  SIZE_LIMIT_ERROR_MESSAGE,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES
};
