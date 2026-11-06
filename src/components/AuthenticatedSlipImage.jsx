import React, { useState, useEffect } from 'react';
import { fetchAuthenticatedSlipBlobUrl } from '../config/api';

/**
 * Renders protected payment slip thumbnails securely using Bearer Authorization headers.
 * Does not expose JWT tokens in query parameters.
 * Automatically revokes object URLs on unmount.
 */
export default function AuthenticatedSlipImage({
  src,
  alt = 'Payment Slip Proof',
  style = {},
  className = '',
  title = '',
  onClick
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let createdUrl = null;

    if (!src) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);

    fetchAuthenticatedSlipBlobUrl(src)
      .then((url) => {
        if (isMounted) {
          createdUrl = url;
          setBlobUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setHasError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9'
        }}
        title="Loading slip securely..."
      >
        <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Loading...</span>
      </div>
    );
  }

  if (hasError || !blobUrl) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          fontSize: '0.65rem',
          textAlign: 'center',
          padding: '2px',
          fontWeight: 600
        }}
        title="Payment slip requires authorized access"
      >
        <span>Protected</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      style={style}
      className={className}
      title={title}
      onClick={onClick}
    />
  );
}

