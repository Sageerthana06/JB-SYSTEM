import React, { useState, useRef } from 'react';
import { Upload, Camera, Trash2, RefreshCw, CheckCircle, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  ACCEPT_IMAGE_INPUT_STRING,
  validateImageFileClient,
  formatFileSize
} from '../../utils/imageUploadHelper';

/**
 * ImageUploadCapture
 * Unified image selection control providing:
 * 1. "Upload Image" (file selection from device storage)
 * 2. "Take Photo" (direct live camera capture with rear/front switching)
 * 3. Exact 20 MB file size limit and validation
 * 4. Supported formats: JPG, JPEG, PNG, WebP, GIF, BMP
 * 5. Instant preview with file size, format badge, retake/replace, and remove
 */
export const ImageUploadCapture = ({
  label,
  sublabel,
  currentImageUrl,
  previewUrl,
  file,
  onFileSelected,
  onFileRemoved,
  error,
  onError,
  required = false,
  isUploading = false,
  uploadProgress = null,
  compact = false,
  cameraTitle = 'Take Photo',
  style = {}
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef(null);

  const displayPreview = previewUrl || currentImageUrl;

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files?.[0];
    // Reset file input value so re-selecting the same file triggers onChange
    e.target.value = '';

    if (!selectedFile) return;

    const validation = validateImageFileClient(selectedFile);
    if (!validation.valid) {
      if (onError) onError(validation.error);
      return;
    }

    if (onError) onError('');
    if (onFileSelected) onFileSelected(selectedFile);
  };

  const handleCameraCapture = (capturedFile) => {
    const validation = validateImageFileClient(capturedFile);
    if (!validation.valid) {
      if (onError) onError(validation.error);
      return;
    }

    if (onError) onError('');
    if (onFileSelected) onFileSelected(capturedFile);
  };

  return (
    <div style={{ width: '100%', ...style }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '0.86rem',
            fontWeight: 800,
            color: 'var(--text-main, #0f172a)',
            marginBottom: '4px'
          }}
        >
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      {sublabel && (
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-muted, #64748b)',
            marginBottom: '10px'
          }}
        >
          {sublabel}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '8px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            border: '1px solid #fecaca'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden file input for native file browsing */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGE_INPUT_STRING}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraTitle}
      />

      {/* When an image is present / previewed */}
      {displayPreview ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            backgroundColor: '#ffffff',
            padding: compact ? '8px 12px' : '14px 16px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                position: 'relative',
                width: compact ? '48px' : '64px',
                height: compact ? '48px' : '64px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                flexShrink: 0
              }}
            >
              <img
                src={displayPreview}
                alt="Selected preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#059669',
                  fontSize: '0.85rem',
                  fontWeight: 800
                }}
              >
                <CheckCircle size={15} />
                <span>Image Selected</span>
              </div>

              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#64748b',
                  marginTop: '2px',
                  maxWidth: '220px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {file ? file.name : (typeof displayPreview === 'string' ? displayPreview.split('/').pop() : 'Attached Image')}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                {file && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {formatFileSize(file.size)}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  Max 20 MB
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons on attached image: Replace via upload / camera, or Remove */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={isUploading}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Replace image from files"
            >
              <Upload size={13} />
              <span>Replace</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={isUploading}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Take new photo using camera"
            >
              <Camera size={13} />
              <span>Camera</span>
            </button>

            {onFileRemoved && (
              <button
                type="button"
                onClick={onFileRemoved}
                disabled={isUploading}
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Remove Image"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        // When no image is selected yet: Show "Upload Image" and "Take Photo" options
        <div
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '14px',
            padding: compact ? '16px' : '22px',
            backgroundColor: '#f8fafc',
            textAlign: 'center',
            transition: 'border-color 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#e0e7ff',
              color: '#4338ca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ImageIcon size={24} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontWeight: 800,
                color: '#0f172a',
                fontSize: compact ? '0.88rem' : '0.95rem'
              }}
            >
              Select an Image or Capture Photo
            </div>
            <div
              style={{
                fontSize: '0.76rem',
                color: '#64748b',
                marginTop: '4px'
              }}
            >
              Supports JPG, JPEG, PNG, WebP, GIF, BMP • <strong style={{ color: '#0369a1' }}>Max 20 MB per image</strong>
            </div>
          </div>

          {/* Dual Action Buttons: Upload Image & Take Photo */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '360px'
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={isUploading}
              style={{
                flex: '1 1 140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <Upload size={16} color="#2563eb" />
              <span>Upload Image</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={isUploading}
              style={{
                flex: '1 1 140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Camera size={16} />
              <span>Take Photo</span>
            </button>
          </div>

          {isUploading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#2563eb',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginTop: '4px'
              }}
            >
              <RefreshCw size={14} className="spin-animation" />
              <span>Uploading image ({uploadProgress ? `${uploadProgress}%` : 'processing'})...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
