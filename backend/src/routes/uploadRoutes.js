const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
  upload,
  validateImageFile,
  SIZE_LIMIT_ERROR_MESSAGE,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS
} = require('../middleware/uploadMiddleware');

// Upload endpoint — requires authentication (all authorized staff, craftsmen, and customers)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('SUPER_ADMIN', 'CEO', 'ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CUSTOMER'),
  (req, res) => {
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

      const files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);

      if (files.length === 0) {
        return res.status(400).json({ success: false, message: 'No file provided.' });
      }

      const primaryFile = files[0];

      // Validate every uploaded file for size and magic bytes
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          try { fs.unlinkSync(file.path); } catch {}
          return res.status(400).json({ success: false, message: SIZE_LIMIT_ERROR_MESSAGE });
        }

        const validation = validateImageFile(file.path);
        if (!validation.valid) {
          try { fs.unlinkSync(file.path); } catch {}
          return res.status(400).json({
            success: false,
            message: validation.error || 'Invalid image content.'
          });
        }
      }

      // Return the relative path to be stored in the database
      const relativePath = `/uploads/designs/${primaryFile.filename}`;

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        imageUrl: relativePath,
        photoUrl: relativePath,
        filename: primaryFile.filename,
        size: primaryFile.size,
        maxSizeLimit: MAX_FILE_SIZE,
        allowedExtensions: ALLOWED_EXTENSIONS
      });
    });
  }
);

module.exports = router;
