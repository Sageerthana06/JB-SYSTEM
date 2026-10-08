import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../utils/router';
import { API_URL } from '../../config/api';
import {
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const CustomerLogin = () => {
  const { customerLogin } = useAuth();
  const { navigate } = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotErr, setForgotErr] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter your email or mobile number and password.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await customerLogin(identifier, password);
    setLoading(false);

    if (res.success) {
      navigate('/customer/dashboard');
    } else {
      setError(res.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (forgotStep === 1) {
      if (!forgotIdentifier) {
        setForgotErr('Please enter your email or mobile number.');
        return;
      }
      setForgotLoading(true);
      setForgotErr('');
      setForgotMsg('');

      try {
        const res = await fetch(`${API_URL}/api/customer-portal/forgot-password/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotIdentifier })
        });
        const data = await res.json();
        setForgotLoading(false);

        if (data.success) {
          setForgotMsg(data.message || 'OTP sent successfully!');
          setForgotStep(2);
          setTimeout(() => setForgotMsg(''), 3000);
        } else {
          setForgotErr(data.message || 'Failed to send OTP.');
        }
      } catch (err) {
        setForgotLoading(false);
        setForgotErr('Network error. Please try again.');
      }
    } else {
      if (!forgotIdentifier || !forgotOtp || !newPassword) {
        setForgotErr('Please fill in all fields.');
        return;
      }
      if (newPassword.length < 6) {
        setForgotErr('New password must be at least 6 characters long.');
        return;
      }

      setForgotLoading(true);
      setForgotErr('');
      setForgotMsg('');

      try {
        const res = await fetch(`${API_URL}/api/customer-portal/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotIdentifier, otp: forgotOtp, newPassword })
        });
        const data = await res.json();
        setForgotLoading(false);

        if (data.success) {
          setForgotMsg('Password reset successfully! You can now log in.');
          setTimeout(() => {
            setShowForgotModal(false);
            setForgotStep(1);
            setForgotOtp('');
            setNewPassword('');
            setForgotMsg('');
            setIdentifier(forgotIdentifier);
          }, 1800);
        } else {
          setForgotErr(data.message || 'Failed to reset password.');
        }
      } catch (err) {
        setForgotLoading(false);
        setForgotErr('Network error. Please try again.');
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#071324',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(0, 82, 204, 0.22) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(217, 4, 41, 0.18) 0%, transparent 40%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '38px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        position: 'relative'
      }}>
        {/* Back to Staff Login Link */}
        <button
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0052cc';
            e.currentTarget.style.backgroundColor = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ArrowLeft size={16} />
          <span>Staff Portal</span>
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginTop: '16px', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            backgroundColor: '#eff6ff',
            color: '#0052cc',
            fontSize: '0.78rem',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '12px'
          }}>
            <Sparkles size={15} />
            <span>Customer Portal</span>
          </div>

          <h1 style={{
            fontSize: '1.9rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 8px 0',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.02em'
          }}>
            Welcome Back
          </h1>
          <p style={{
            fontSize: '0.88rem',
            color: '#64748b',
            margin: 0,
            lineHeight: 1.5
          }}>
            Sign in to track your orders, book fittings, and view custom tailoring progress.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {/* Email / Phone Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#334155',
              marginBottom: '6px'
            }}>
              Email / Mobile Number
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="#0052cc"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                id="customer-identifier-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. +9477XXXXXXX or name@email.com"
                required
                style={{
                  width: '100%',
                  padding: '13px 14px 13px 44px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.92rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0052cc';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 82, 204, 0.15)';
                  e.target.style.backgroundColor = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = '#f8fafc';
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155'
              }}>
                Password
              </label>
              <button
                type="button"
                id="forgot-password-link"
                onClick={() => {
                  setForgotIdentifier(identifier);
                  setShowForgotModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0052cc',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgot Password?
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="#0052cc"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                id="customer-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '13px 44px 13px 44px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.92rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0052cc';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 82, 204, 0.15)';
                  e.target.style.backgroundColor = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = '#f8fafc';
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
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              margin: '14px 0',
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
              <span>{error}</span>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            id="customer-login-button"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#0052cc',
              color: '#ffffff',
              fontSize: '0.98rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0, 82, 204, 0.35)',
              transition: 'all 0.2s ease',
              marginTop: '20px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#0043a8';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#0052cc';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <span>{loading ? 'Authenticating...' : 'Sign In as Customer'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Register Prompt */}
        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '0.88rem',
            color: '#64748b',
            margin: 0
          }}>
            New to Bella Design?{' '}
            <button
              id="goto-register-link"
              onClick={() => navigate('/customer/register')}
              style={{
                background: 'none',
                border: 'none',
                color: '#d90429',
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Create Customer Account
            </button>
          </p>
        </div>

        {/* Security badge */}
        <div style={{
          marginTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: '#94a3b8',
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Encrypted Tailoring Account Protection</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px 24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Reset Password
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
              {forgotStep === 1 
                ? 'Enter your registered phone or email to receive an OTP.' 
                : 'Enter the OTP sent to you and set a new password.'}
            </p>

            <form onSubmit={handleForgotPassword}>
              {forgotStep === 1 ? (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Email or Mobile Number
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="Registered phone or email"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      OTP
                    </label>
                    <input
                      type="text"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      New Password (min 6 characters)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </>
              )}

              {forgotErr && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '12px', fontWeight: 600 }}>
                  {forgotErr}
                </div>
              )}

              {forgotMsg && (
                <div style={{ color: '#16a34a', fontSize: '0.82rem', marginBottom: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>{forgotMsg}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStep(1);
                    setForgotOtp('');
                    setNewPassword('');
                    setForgotErr('');
                    setForgotMsg('');
                  }}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: forgotLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {forgotLoading 
                    ? (forgotStep === 1 ? 'Sending...' : 'Updating...') 
                    : (forgotStep === 1 ? 'Send OTP' : 'Set Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
