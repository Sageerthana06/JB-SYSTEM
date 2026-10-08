const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Upload endpoint — requires authentication (STAFF, ADMIN, MANAGER, and CUSTOMER can upload files)
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'), (req, res) => {
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

    const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file provided.' });
    }

    // Return the relative path to be stored in the database
    const relativePath = `/uploads/designs/${file.filename}`;
    
    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      imageUrl: relativePath,
      photoUrl: relativePath
    });
  });
});

module.exports = router;
