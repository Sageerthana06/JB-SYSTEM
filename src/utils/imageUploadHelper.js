/**
 * Image Upload Helper & Validation Constants
 * Enforces 20 MB maximum file size and supported image formats:
 * JPG, JPEG, PNG, WebP, GIF, BMP.
 */

export const MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024; // 20 MB = 20,971,520 bytes
export const IMAGE_SIZE_ERROR_MESSAGE = 'Image size must not exceed 20 MB.';

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
  'image/jpg'
];

export const ACCEPT_IMAGE_INPUT_STRING = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp';

/**
 * Validates an image file on the client before upload.
 * Returns { valid: boolean, error?: string }
 */
export const validateImageFileClient = (file) => {
  if (!file) {
    return { valid: false, error: 'No image file selected.' };
  }

  // 1. Validate File Size (Strictly 20 MB limit per image)
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return { valid: false, error: IMAGE_SIZE_ERROR_MESSAGE };
  }

  // 2. Validate MIME Type & Extension
  const mimeType = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';

  const isMimeValid = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType) || mimeType === '';
  const isExtValid = ALLOWED_IMAGE_EXTENSIONS.includes(ext);

  if (!isMimeValid && !isExtValid) {
    return {
      valid: false,
      error: 'Invalid image format. Supported formats: JPG, JPEG, PNG, WebP, GIF, and BMP.'
    };
  }

  // Reject SVG explicitly on client for security
  if (mimeType.includes('svg') || ext === '.svg') {
    return {
      valid: false,
      error: 'SVG format is not supported. Please upload JPG, PNG, WebP, GIF, or BMP images.'
    };
  }

  return { valid: true };
};

/**
 * Formats file size in readable MB or KB
 */
export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
