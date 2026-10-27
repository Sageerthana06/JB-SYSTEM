import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../utils/router';
import {
  Lock,
  Mail,
  Phone,
  User,
  MapPin,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { validatePhoneNumber, normalizePhoneNumber } from '../../utils/phoneUtils';

export const CustomerRegister = () => {
  const { customerRegister } = useAuth();
  const { navigate } = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    primaryPhone: '',
    email: '',
    password: '',
    address: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.primaryPhone.trim() || !formData.password.trim()) {
      setError('Please fill in your name, phone number, and password.');
      return;
    }

    const phoneVal = validatePhoneNumber(formData.primaryPhone);
    if (!phoneVal.valid) {
      setError(phoneVal.error || 'Please enter a valid phone number.');
      return;
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      name: formData.name.trim(),
      primaryPhone: normalizePhoneNumber(formData.primaryPhone) || formData.primaryPhone.trim(),
      email: formData.email ? formData.email.trim().toLowerCase() : '',
      password: formData.password,
      address: formData.address ? formData.address.trim() : ''
    };

    const res = await customerRegister(payload);
    setLoading(false);

    if (res.success) {
      navigate('/customer/dashboard');
    } else {
      setError(res.message || 'Registration failed.');
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
        maxWidth: '480px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        position: 'relative'
      }}>
        {/* Back Link */}
        <button
          onClick={() => navigate('/customer/login')}
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
            borderRadius: '8px'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginTop: '14px', marginBottom: '24px' }}>
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
            marginBottom: '10px'
          }}>
            <Sparkles size={15} />
            <span>New Customer Registration</span>
          </div>

          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 6px 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Create Your Account
          </h1>
          <p style={{
            fontSize: '0.86rem',
            color: '#64748b',
            margin: 0
          }}>
            Join Bella Design to order bespoke dresses & track every stitch in real time.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister}>
          {/* Full Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Full Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Priyanthi Jayawardena"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Primary Phone */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              WhatsApp / Mobile Number *
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                name="primaryPhone"
                value={formData.primaryPhone}
                onChange={handleChange}
                placeholder="e.g. +94771234567 or 0771234567"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Email Address (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. priyanthi@example.com (optional)"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Password (at least 6 characters) *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Choose a secure password"
                required
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
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

          {/* Delivery / Fitting Address */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
              Fitting / Delivery Address (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <MapPin size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '14px' }} />
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                placeholder="Street address, city"
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'none'
                }}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              marginBottom: '14px',
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#d90429',
              color: '#ffffff',
              fontSize: '0.98rem',
              fontWeight: 800,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(217, 4, 41, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Existing account prompt */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Already have an account?{' '}
            <button
              onClick={() => navigate('/customer/login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#0052cc',
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
