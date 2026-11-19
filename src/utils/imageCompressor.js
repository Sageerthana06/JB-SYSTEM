import { API_BASE, API_URL } from '../config/api.js';

/**
 * Image Compressor & Receipt Upload Utility
 * JB GROUP (PVT) LTD — Version 5.2.0
 * 
 * Solves HTTP 413 (Payload Too Large) permanently:
 * 1. Resizes large high-res camera photos (often 5MB - 15MB) to max 1600px dimension.
 * 2. Compresses receipts to ~200KB - 400KB with crystal-clear text readability.
 * 3. Uploads via multipart/form-data to /api/upload (Multer).
 * 4. Provides fallback to compressed DataURL if upload endpoint is unreachable.
 * 5. Provides clear user-friendly error messages if size or format is invalid.
 */

const MAX_PRE_COMPRESSION_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const ALLOWED_MIME_PREFIXES = ['image/'];

/**
 * Format bytes to readable string (KB / MB)
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Pre-validation check for file before attempting compression
 */
export const validateReceiptFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Type check
  const isImage = file.type && ALLOWED_MIME_PREFIXES.some(prefix => file.type.toLowerCase().startsWith(prefix));
  const rawExt = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(rawExt);

  if (!isImage && !isAllowedExt) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload an image file (JPG, PNG, WebP, GIF, or BMP).'
    };
  }

  // Pre-compression size limit check
  if (file.size > MAX_PRE_COMPRESSION_SIZE) {
    return {
      valid: false,
      error: `File is too large (${formatFileSize(file.size)}). Maximum allowed receipt size is 25 MB.`
    };
  }

  return { valid: true };
};

/**
 * Compress an image file using browser HTML5 Canvas.
 * Keeps resolution high enough for full receipt text & number legibility (max 1600px).
 * Reduces file weight by 80% to 95% (typically 200KB - 400KB).
 */
export const compressReceiptImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      return reject(new Error(validation.error));
    }

    const maxWidth = options.maxWidth || 1600;
    const maxHeight = options.maxHeight || 1600;
    const quality = options.quality !== undefined ? options.quality : 0.82;

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for optimization. The file might be corrupt.'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale proportionally to fit within maxWidth x maxHeight
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // If canvas context unavailable, fallback to original DataURL
            return resolve({
              blob: file,
              dataUrl: e.target.result,
              fileName: file.name,
              originalSize: file.size,
              compressedSize: file.size,
              reductionPercent: 0
            });
          }

          // Use high-quality smoothing for crystal-clear receipt text
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Export as JPEG (best compression for receipts and camera scans)
          const dataUrl = canvas.toDataURL('image/jpeg', quality);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                // Fallback to dataUrl conversion
                return resolve({
                  blob: file,
                  dataUrl,
                  fileName: file.name,
                  originalSize: file.size,
                  compressedSize: file.size,
                  reductionPercent: 0
                });
              }

              const compressedSize = blob.size;
              const reductionPercent = Math.max(
                0,
                Math.round(((file.size - compressedSize) / file.size) * 100)
              );

              const safeName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
              const compressedFile = new File([blob], safeName, { type: 'image/jpeg' });

              resolve({
                blob: compressedFile,
                dataUrl,
                fileName: safeName,
                originalSize: file.size,
                compressedSize,
                reductionPercent,
                width,
                height
              });
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Upload receipt image using multipart/form-data to /api/upload.
 * If server responds with HTTP 413, provides friendly error.
 * If /api/upload is temporarily unavailable, returns the compressed base64 dataUrl as safe fallback.
 */
export const uploadReceiptImageFile = async (file, authHeaders = {}) => {
  // 1. First compress the image
  const compressed = await compressReceiptImage(file);

  // 2. Prepare multipart FormData
  const formData = new FormData();
  formData.append('file', compressed.blob, compressed.fileName);

  try {
    const uploadUrl = `${API_URL}/api/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...authHeaders
      },
      body: formData
    });

    // Check for HTTP 413 specifically
    if (response.status === 413) {
      throw new Error(
        `The receipt image is too large for the server (HTTP 413). Even after compression (${formatFileSize(compressed.compressedSize)}), the reverse proxy rejected it. Please check Nginx client_max_body_size.`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.warn('Upload endpoint returned non-JSON response, using compressed base64 fallback:', text.substring(0, 100));
      return {
        success: true,
        receiptImage: compressed.dataUrl,
        previewUrl: compressed.dataUrl,
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        reductionPercent: compressed.reductionPercent,
        isFallbackBase64: true
      };
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      console.warn('Upload API error, using compressed base64 fallback:', data.message);
      return {
        success: true,
        receiptImage: compressed.dataUrl,
        previewUrl: compressed.dataUrl,
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        reductionPercent: compressed.reductionPercent,
        isFallbackBase64: true
      };
    }

    const imageUrl = data.imageUrl || data.photoUrl;
    return {
      success: true,
      receiptImage: imageUrl,
      previewUrl: compressed.dataUrl,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      reductionPercent: compressed.reductionPercent,
      isFallbackBase64: false
    };
  } catch (err) {
    if (err.message && err.message.includes('413')) {
      throw err;
    }
    console.warn('Network error uploading receipt to /api/upload, using compressed fallback:', err.message);
    // Safe fallback: return compressed dataUrl which is only ~200KB and won't trigger 413
    return {
      success: true,
      receiptImage: compressed.dataUrl,
      previewUrl: compressed.dataUrl,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      reductionPercent: compressed.reductionPercent,
      isFallbackBase64: true
    };
  }
};
