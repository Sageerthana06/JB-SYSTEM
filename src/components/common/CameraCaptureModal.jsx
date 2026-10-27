import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, FlipHorizontal } from 'lucide-react';
import { MAX_IMAGE_FILE_SIZE, IMAGE_SIZE_ERROR_MESSAGE, formatFileSize } from '../../utils/imageUploadHelper';

/**
 * CameraCaptureModal
 * Direct mobile & desktop camera photo capture with:
 * - Live camera stream preview
 * - Rear camera preferred by default (ideal for fabrics, garments, design sketches)
 * - Front/rear camera switching
 * - High-resolution snapshot capture
 * - Retake and confirm flow
 * - 20 MB size validation
 * - Graceful fallback to native device camera / file picker if getUserMedia is denied/unavailable
 */
export const CameraCaptureModal = ({ isOpen, onClose, onCapture, title = 'Take Photo' }) => {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (rear) or 'user' (front)
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedFileSize, setCapturedFileSize] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fallbackInputRef = useRef(null);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping camera track:', e);
        }
      });
      setStream(null);
    }
  }, [stream]);

  // Start camera stream
  const startCamera = useCallback(async (facing) => {
    setIsLoadingCamera(true);
    setErrorMsg('');

    // First stop any existing stream
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsCameraSupported(false);
      setIsLoadingCamera(false);
      setErrorMsg('Direct browser camera is not supported or requires a secure HTTPS connection. Please select or capture a photo using your device options below.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraSupported(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.warn('Video play error:', e));
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setIsCameraSupported(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access was denied. Please grant camera permission in your browser settings, or select a photo from your device.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('No camera device detected on this device. You can select a photo from your device storage.');
      } else {
        setErrorMsg(`Unable to access camera (${err.message || 'Unknown error'}). You can select a photo directly from your device.`);
      }
    } finally {
      setIsLoadingCamera(false);
    }
  }, [stream]);

  // Open camera on modal open
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreview(null);
      setCapturedFileSize(0);
      setErrorMsg('');
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Ensure video element plays when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, [stream]);

  // Flip between rear and front camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture current frame from video onto canvas
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setErrorMsg('Failed to process captured image.');
        return;
      }

      if (blob.size > MAX_IMAGE_FILE_SIZE) {
        setErrorMsg(IMAGE_SIZE_ERROR_MESSAGE);
        return;
      }

      setCapturedBlob(blob);
      setCapturedFileSize(blob.size);
      const previewUrl = URL.createObjectURL(blob);
      setCapturedPreview(previewUrl);

      // Pause live stream while previewing
      stopStream();
    }, 'image/jpeg', 0.92);
  };

  // Retake photo: clear captured preview and restart camera
  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    setCapturedFileSize(0);
    setErrorMsg('');
    startCamera(facingMode);
  };

  // Confirm photo: create File object and pass to callback
  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;

    if (capturedBlob.size > MAX_IMAGE_FILE_SIZE) {
      setErrorMsg(IMAGE_SIZE_ERROR_MESSAGE);
      return;
    }

    const timestamp = Date.now();
    const fileName = `camera_photo_${timestamp}.jpg`;
    const file = new File([capturedBlob], fileName, { type: 'image/jpeg' });

    stopStream();
    onCapture(file);
    handleCloseModal();
  };

  // Handle fallback native mobile camera input
  const handleFallbackChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setErrorMsg(IMAGE_SIZE_ERROR_MESSAGE);
      return;
    }

    stopStream();
    onCapture(file);
    handleCloseModal();
  };

  const handleCloseModal = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    stopStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '560px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Camera size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{title}</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Max file size: 20 MB • Auto-optimized
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!capturedPreview && isCameraSupported && (
              <button
                type="button"
                onClick={handleToggleFacingMode}
                title="Switch Front/Rear Camera"
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FlipHorizontal size={14} />
                <span>{facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseModal}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px'
              }}
              title="Close Camera"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#450a0a',
              color: '#fca5a5',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #7f1d1d'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Viewport Area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '360px',
            backgroundColor: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {capturedPreview ? (
            // Frozen Capture Preview
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={capturedPreview}
                alt="Captured Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}
              >
                Photo Size: {formatFileSize(capturedFileSize)}
              </div>
            </div>
          ) : isCameraSupported ? (
            // Live Video Feed
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              {isLoadingCamera && (
                <div
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#94a3b8'
                  }}
                >
                  <RefreshCw size={28} className="spin-animation" />
                  <span style={{ fontSize: '0.85rem' }}>Initializing Camera...</span>
                </div>
              )}
            </>
          ) : (
            // Fallback screen when camera access is unavailable/denied
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                maxWidth: '400px'
              }}
            >
              <Camera size={44} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#e2e8f0' }}>
                Camera Access Unavailable
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                Use your device's native photo taker or file gallery to attach an image (up to 20 MB).
              </p>
              <button
                type="button"
                onClick={() => fallbackInputRef.current && fallbackInputRef.current.click()}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Camera size={18} />
                <span>Select or Capture from Device</span>
              </button>
              <input
                ref={fallbackInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                capture="environment"
                onChange={handleFallbackChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Hidden Canvas used for high-res photo capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Modal Controls / Footer */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {capturedPreview ? (
            // Preview Actions: Retake vs Confirm
            <>
              <button
                type="button"
                onClick={handleRetake}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #475569',
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={15} />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}
              >
                <Check size={18} />
                <span>Confirm & Use Photo</span>
              </button>
            </>
          ) : (
            // Shutter Control
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isCameraSupported ? (
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={isLoadingCamera}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    border: '5px solid #2563eb',
                    cursor: isLoadingCamera ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Take Photo"
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb'
                    }}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid #475569',
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
