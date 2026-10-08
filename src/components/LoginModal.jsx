import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  User,
  Scissors,
  ArrowRight,
  X,
  ShieldCheck,
  Sparkles,
  Award
} from 'lucide-react';

export const LoginModal = () => {
  const { isLoginOpen, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log("Video autoplay attempt:", err);
      });
    }
  }, [isLoginOpen]);

  if (!isLoginOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    const result = await login(email.trim().toLowerCase(), password);
    setLoginLoading(false);
    if (!result.success) {
      setLoginError(result.message || 'Login failed. Please check your credentials.');
    }
  };



  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#020617',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '24px 16px',
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* 🎬 1. HIGH-DEFINITION TAILORING WORKSHOP VIDEO MOTION LAYER */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="animate-cinematic-zoom"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'brightness(0.3) contrast(1.25) saturate(1.4)',
          zIndex: 1
        }}
      >
        <source src="/tailoring_video.mp4" type="video/mp4" />
      </video>

      {/* 🔵 2. INTENSE ROYAL BLUE NEON AURA - LEFT */}
      <div className="animate-pulse-glow-navy" style={{
        position: 'absolute',
        top: '50%',
        left: 'calc(50% - 420px)',
        transform: 'translateY(-50%)',
        width: '550px',
        height: '650px',
        background: 'radial-gradient(circle, rgba(0, 82, 204, 0.85) 0%, rgba(29, 78, 216, 0.35) 50%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 2,
        filter: 'blur(60px)'
      }}></div>

      {/* 🔴 3. INTENSE CRIMSON RED NEON AURA - RIGHT */}
      <div className="animate-pulse-glow-crimson" style={{
        position: 'absolute',
        top: '50%',
        right: 'calc(50% - 420px)',
        transform: 'translateY(-50%)',
        width: '550px',
        height: '650px',
        background: 'radial-gradient(circle, rgba(217, 4, 41, 0.85) 0%, rgba(225, 29, 72, 0.35) 50%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 2,
        filter: 'blur(60px)'
      }}></div>

      {/* ✨ 4. FLOATING PARTICLES & ANIMATED SPARKLES LAYER */}
      <div className="animate-float-particle-1" style={{ position: 'absolute', top: '14%', left: '10%', color: '#60a5fa', opacity: 0.9, zIndex: 3, pointerEvents: 'none' }}>
        <Sparkles size={38} className="animate-twinkle" />
      </div>
      <div className="animate-float-particle-2" style={{ position: 'absolute', bottom: '16%', right: '12%', color: '#f87171', opacity: 0.9, zIndex: 3, pointerEvents: 'none' }}>
        <Sparkles size={42} className="animate-twinkle" />
      </div>
      <div className="animate-float-particle-1" style={{ position: 'absolute', top: '24%', right: '18%', color: '#38bdf8', opacity: 0.85, zIndex: 3, pointerEvents: 'none' }}>
        <Scissors size={34} />
      </div>
      <div className="animate-float-particle-2" style={{ position: 'absolute', bottom: '22%', left: '16%', color: '#fbbf24', opacity: 0.85, zIndex: 3, pointerEvents: 'none' }}>
        <Award size={36} />
      </div>

      {/* ⚡ 5. BOLD DUAL-TONE (ROYAL BLUE & CRIMSON RED ONLY) ROTATING BORDER CONTAINER */}
      <div
        className="animate-modal-entry animate-card-glow-bold"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '445px',
          borderRadius: '34px',
          padding: '7px',
          overflow: 'hidden',
          margin: 'auto'
        }}
      >
        {/* Continuous 360-Degree Rotating Conic Beam strictly Blue (#0052cc) and Red (#d90429) */}
        <div
          className="animate-spin-blue-red"
          style={{
            position: 'absolute',
            inset: '-150%',
            background: 'conic-gradient(from 0deg, #0052cc 0%, #d90429 25%, #0052cc 50%, #d90429 75%, #0052cc 100%)',
            zIndex: 1
          }}
        />

        {/* Crisp Pure White Inner Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '27px',
          padding: '38px 34px 30px 34px',
          position: 'relative',
          zIndex: 2,
          boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.9)'
        }}>
          {/* Close Modal Button */}
          <button
            onClick={() => setIsLoginOpen(false)}
            title="Close"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
              e.currentTarget.style.color = '#d90429';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            <X size={18} />
          </button>

          {/* Top Logo & Header Section */}
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <p style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#64748b',
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              margin: '0 0 8px 0'
            }}>
              WELCOME TO
            </p>

            <div
              className="animate-logo-glow"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '4px',
                transition: 'all 0.3s ease'
              }}
            >
              <img
                src="/jb_official_logo.png"
                alt="JB GROUP Logo"
                style={{
                  height: '44px',
                  objectFit: 'contain'
                }}
              />
              <h1 style={{
                fontSize: '2.2rem',
                fontWeight: 900,
                margin: 0,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                fontFamily: "'Outfit', sans-serif"
              }}>
                <span style={{ color: '#d90429' }}>J</span>
                <span style={{ color: '#0052cc' }}>B</span>
                <span style={{ color: '#0f172a', marginLeft: '5px' }}>GROUP</span>
              </h1>
            </div>

            <p style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#1e293b',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              margin: '6px 0 12px 0'
            }}>
              BUSINESS MANAGEMENT SYSTEM
            </p>

            {/* Red Underline Pill Accent */}
            <div style={{
              width: '38px',
              height: '3.5px',
              backgroundColor: '#d90429',
              margin: '0 auto 12px auto',
              borderRadius: '999px',
              boxShadow: '0 0 12px rgba(217, 4, 41, 0.65)'
            }}></div>

            <p style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#475569',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              margin: '0 0 3px 0'
            }}>
              PEOPLE &nbsp;|&nbsp; SYSTEMS &nbsp;|&nbsp; GROWTH
            </p>
            <p style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              margin: 0
            }}>
              A BETTER TOMORROW
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} autoComplete="off">
            {/* Email / Username Input */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <Mail
                size={19}
                color="#d90429"
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                name="jb_account_identifier"
                id="jb_account_identifier"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email / Username"
                required
                autoComplete="off"
                spellCheck="false"
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  borderRadius: '14px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.925rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0052cc';
                  e.target.style.boxShadow = '0 0 0 4px rgba(0, 82, 204, 0.18)';
                  e.target.style.backgroundColor = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = '#f8fafc';
                }}
              />
            </div>

            {/* Password Input */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Lock
                size={19}
                color="#0052cc"
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                name="jb_account_credential"
                id="jb_account_credential"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 48px',
                  borderRadius: '14px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.925rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0052cc';
                  e.target.style.boxShadow = '0 0 0 4px rgba(0, 82, 204, 0.18)';
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
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <Eye size={19} /> : <EyeOff size={19} />}
              </button>
            </div>

            {/* Checkbox & Forgot Link Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '22px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                color: '#1e293b',
                fontWeight: 700,
                cursor: 'pointer',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  defaultChecked
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    accentColor: '#0052cc',
                    cursor: 'pointer'
                  }}
                />
                Keep me logged in
              </label>

              <a
                href="#forgot"
                onClick={(e) => e.preventDefault()}
                style={{
                  fontSize: '0.85rem',
                  color: '#0052cc',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
                }}
              >
                Forgot password?
              </a>
            </div>

            {/* 🌟 Luxury Shimmer Gradient LOGIN Button with Animated Nudge Arrow */}
            <button
              type="submit"
              className="shine-button"
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #0042b3 0%, #0052cc 40%, #d90429 100%)',
                color: '#ffffff',
                fontSize: '1.05rem',
                fontWeight: 800,
                letterSpacing: '2px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px -4px rgba(0, 66, 179, 0.5), 0 8px 24px -4px rgba(217, 4, 41, 0.5)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                e.currentTarget.style.boxShadow = '0 14px 32px -4px rgba(0, 66, 179, 0.7), 0 14px 32px -4px rgba(217, 4, 41, 0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(0, 66, 179, 0.5), 0 8px 24px -4px rgba(217, 4, 41, 0.5)';
              }}
              disabled={loginLoading}
            >
              <span>{loginLoading ? 'Signing In...' : 'LOGIN'}</span>
              {!loginLoading && (
                <div className="animate-arrow-nudge" style={{ display: 'flex', alignItems: 'center' }}>
                  <ArrowRight size={20} />
                </div>
              )}
            </button>

            {/* Login Error Message */}
            {loginError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '10px',
                color: '#DC2626',
                fontSize: '0.85rem',
                fontWeight: 600,
                textAlign: 'center'
              }}>
                {loginError}
              </div>
            )}
          </form>

          {/* Form Divider */}
          <div style={{
            margin: '22px 0 18px 0',
            height: '1px',
            backgroundColor: '#e2e8f0'
          }} />

          {/* Separate Customer Entry below staff role section */}
          <div style={{
            marginBottom: '20px',
            padding: '16px 14px',
            backgroundColor: '#f8fafc',
            border: '1.5px dashed #cbd5e1',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <p style={{
              margin: '0 0 10px 0',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#475569'
            }}>
              Are you a Customer?
            </p>
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/customer/login');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '12px',
                border: '1.5px solid #0052cc',
                backgroundColor: '#ffffff',
                color: '#0052cc',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0, 82, 204, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0052cc';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 82, 204, 0.25)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#0052cc';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 82, 204, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <User size={18} />
              <span>Customer Login</span>
            </button>
          </div>

          {/* Security Access Footer Banner with Pulsing Live Node Dot */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#64748b',
            fontSize: '0.8rem',
            fontWeight: 600,
            backgroundColor: '#f8fafc',
            padding: '8px 14px',
            borderRadius: '999px',
            border: '1px solid #f1f5f9'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }} className="animate-twinkle"></span>
            <ShieldCheck size={16} color="#0052cc" />
            <span>Secure Access for Authorized Staff Only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
