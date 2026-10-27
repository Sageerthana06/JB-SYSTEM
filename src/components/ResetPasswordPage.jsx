import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  ArrowLeft
} from 'lucide-react';

export const ResetPasswordPage = ({ token, onComplete }) => {
  const [tokenStatus, setTokenStatus] = useState('verifying'); // 'verifying', 'valid', 'invalid'
  const [userInfo, setUserInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenStatus('invalid');
      setErrorMessage('No reset token provided in URL.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.success && data.valid) {
          setTokenStatus('valid');
          setUserInfo(data.user);
        } else {
          setTokenStatus('invalid');
          setErrorMessage(data.message || 'This reset link has expired or has already been used.');
        }
      } catch (err) {
        setTokenStatus('invalid');
        setErrorMessage('Failed to connect to verification server. Please check your internet connection.');
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      setSubmitting(false);

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          } else {
            window.location.href = '/';
          }
        }, 2200);
      } else {
        setErrorMessage(data.message || 'Failed to update password.');
      }
    } catch (err) {
      setSubmitting(false);
      setErrorMessage('Network error resetting password. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#071324',
      backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(0, 82, 204, 0.25) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(217, 4, 41, 0.2) 0%, transparent 40%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '38px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        position: 'relative'
      }}>
        {/* Logo and Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0052cc 0%, #071324 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(0, 82, 204, 0.3)',
            marginBottom: '16px'
          }}>
            <KeyRound size={26} />
          </div>

          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 6px 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Set New Password
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            {userInfo ? `Account for ${userInfo.name} (${userInfo.email})` : 'JB GROUP Enterprise Portal'}
          </p>
        </div>

        {/* State 1: Verifying */}
        {tokenStatus === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '3px solid #e2e8f0',
              borderTopColor: '#0052cc',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 14px auto'
            }} />
            <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
              Verifying secure token...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* State 2: Invalid / Expired */}
        {tokenStatus === 'invalid' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              padding: '16px',
              backgroundColor: '#fef2f2',
              borderRadius: '14px',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.88rem',
              fontWeight: 600,
              lineHeight: 1.5,
              marginBottom: '20px'
            }}>
              <AlertCircle size={28} style={{ margin: '0 auto 8px auto', display: 'block' }} />
              {errorMessage}
            </div>

            <button
              onClick={() => {
                window.location.href = '/';
              }}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                backgroundColor: '#0052cc',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <ArrowLeft size={16} /> Return to Login
            </button>
          </div>
        )}

        {/* State 3: Valid Token — Show Form */}
        {tokenStatus === 'valid' && !success && (
          <form onSubmit={handleSubmit}>
            {/* New Password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                New Password (minimum 6 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: '#0052cc',
                color: '#ffffff',
                fontSize: '0.98rem',
                fontWeight: 800,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0, 82, 204, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              <span>{submitting ? 'Updating Password...' : 'Save & Set Password'}</span>
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        {/* State 4: Success Message */}
        {success && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
              Password Updated!
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 16px 0' }}>
              Your password has been securely updated. Redirecting to login...
            </p>
          </div>
        )}

        {/* Security Footer */}
        <div style={{
          marginTop: '22px',
          paddingTop: '16px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: '#94a3b8',
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Encrypted Single-Use Password Link</span>
        </div>
      </div>
    </div>
  );
};
