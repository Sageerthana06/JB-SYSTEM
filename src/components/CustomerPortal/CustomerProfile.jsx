import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CustomerPortalLayout } from './CustomerPortalLayout';
import { API_URL, getImageUrl } from '../../config/api';
import { ImageUploadCapture } from '../common/ImageUploadCapture';
import { validateImageFileClient } from '../../utils/imageUploadHelper';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

export const CustomerProfile = () => {
  const { getAuthHeaders } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    primaryPhone: '',
    alternativePhone: '',
    email: '',
    address: '',
    profilePhoto: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Password change state
  const [pwdData, setPwdData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/customer-portal/me`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.customer) {
          setFormData({
            name: data.customer.name || '',
            primaryPhone: data.customer.primaryPhone || '',
            alternativePhone: data.customer.alternativePhone || '',
            email: data.customer.email || '',
            address: data.customer.address || '',
            profilePhoto: data.customer.profilePhoto || ''
          });
        }
      })
      .catch(err => console.error('Error fetching profile:', err))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoSelect = (fileOrEvent) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files?.[0] : fileOrEvent;
    if (file) {
      const validation = validateImageFileClient(file);
      if (!validation.valid) {
        setErrorMsg(validation.error);
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setErrorMsg('');
    }
  };

  const handleRemoveSelectedPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      let res;

      // If a new photo is selected, send multipart/form-data using FormData
      if (photoFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('alternativePhone', formData.alternativePhone || '');
        formDataToSend.append('email', formData.email || '');
        formDataToSend.append('address', formData.address || '');
        formDataToSend.append('profilePhoto', photoFile);

        res = await fetch(`${API_URL}/api/customer-portal/profile`, {
          method: 'PUT',
          headers: getAuthHeaders(true), // Do NOT set Content-Type; allow browser to set multipart/form-data boundary
          body: formDataToSend
        });
      } else {
        // Normal JSON request when no file is uploaded
        res = await fetch(`${API_URL}/api/customer-portal/profile`, {
          method: 'PUT',
          headers: getAuthHeaders(false),
          body: JSON.stringify({
            name: formData.name,
            alternativePhone: formData.alternativePhone,
            email: formData.email,
            address: formData.address,
            profilePhoto: formData.profilePhoto
          })
        });
      }

      const data = await res.json();
      setSaving(false);

      if (data.success) {
        setSuccessMsg(data.message || 'Your profile has been updated successfully.');
        const updated = data.customer;
        if (updated) {
          setFormData(prev => ({
            ...prev,
            name: updated.name || prev.name,
            alternativePhone: updated.alternativePhone || prev.alternativePhone,
            email: updated.email || prev.email,
            address: updated.address || prev.address,
            profilePhoto: updated.profilePhoto || prev.profilePhoto
          }));
        }
        setPhotoFile(null);
        setPhotoPreview(null);
      } else {
        setErrorMsg(data.message || 'Failed to update profile.');
      }
    } catch {
      setSaving(false);
      setErrorMsg('Network error updating profile.');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pwdData.newPassword) {
      setPwdError('Please enter a new password.');
      return;
    }
    if (pwdData.newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters long.');
      return;
    }
    if (pwdData.newPassword !== pwdData.confirmPassword) {
      setPwdError('New password and confirm password do not match.');
      return;
    }

    setPwdLoading(true);
    setPwdSuccess('');
    setPwdError('');

    try {
      const res = await fetch(`${API_URL}/api/customer-portal/change-password`, {
        method: 'PUT',
        headers: getAuthHeaders(false),
        body: JSON.stringify(pwdData)
      });
      const data = await res.json();
      setPwdLoading(false);

      if (data.success) {
        setPwdSuccess(data.message || 'Password changed successfully!');
        setPwdData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setPwdSuccess(''), 4000);
      } else {
        setPwdError(data.message || 'Failed to change password.');
      }
    } catch {
      setPwdLoading(false);
      setPwdError('Network error changing password. Please try again.');
    }
  };

  return (
    <CustomerPortalLayout activePage="profile">
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '1.85rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 6px 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            My Profile
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Manage your personal contact details, email address, and fitting delivery address.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
            Loading your profile...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '32px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
          }}>
            {/* Customer Profile Photo */}
            <div style={{ marginBottom: '24px' }}>
              <ImageUploadCapture
                label="Customer Profile Photo"
                sublabel="Upload a clear portrait photo or take a photo with your device camera (Max 20 MB • JPG, PNG, WebP, GIF, BMP)"
                currentImageUrl={formData.profilePhoto ? getImageUrl(formData.profilePhoto) : null}
                previewUrl={photoPreview}
                file={photoFile}
                onFileSelected={handlePhotoSelect}
                onFileRemoved={handleRemoveSelectedPhoto}
                onError={(err) => setErrorMsg(err)}
                cameraTitle="Take Customer Profile Photo"
                compact={false}
              />
            </div>
            {/* Full Name */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Full Name *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Primary Phone (Permanent identifier) */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Primary WhatsApp / Mobile (Registered Number)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={formData.primaryPhone}
                  disabled
                  title="Contact customer support to change registered primary mobile number"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    fontSize: '0.92rem',
                    color: '#64748b',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Primary mobile number is locked for order record integrity.
              </span>
            </div>

            {/* Alternative Phone */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Alternative Contact Number (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="alternativePhone"
                  value={formData.alternativePhone}
                  onChange={handleChange}
                  placeholder="e.g. 0779998888"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. customer@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Address */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Fitting / Delivery Address
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} color="#0052cc" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Street address, city"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'none'
                  }}
                />
              </div>
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div style={{
                marginBottom: '18px',
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                marginBottom: '18px',
                padding: '12px 16px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                color: '#065f46',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: '#0052cc',
                color: '#ffffff',
                fontSize: '0.98rem',
                fontWeight: 800,
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0, 82, 204, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Save size={18} />
              <span>{saving ? 'Updating Profile...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        )}

        {/* Account Security & Password Change */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '32px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          marginTop: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0052cc'
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Account Security & Password
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                Change your customer portal login password anytime.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} style={{ marginTop: '20px' }}>
            {/* Current Password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  value={pwdData.currentPassword}
                  onChange={(e) => {
                    setPwdData(prev => ({ ...prev, currentPassword: e.target.value }));
                    setPwdError('');
                  }}
                  placeholder="Enter current password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  {showCurrentPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password & Confirm Password */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  New Password (min 6 characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={pwdData.newPassword}
                    onChange={(e) => {
                      setPwdData(prev => ({ ...prev, newPassword: e.target.value }));
                      setPwdError('');
                    }}
                    placeholder="Enter new password"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 44px 12px 14px',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem',
                      color: '#0f172a',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={pwdData.confirmPassword}
                  onChange={(e) => {
                    setPwdData(prev => ({ ...prev, confirmPassword: e.target.value }));
                    setPwdError('');
                  }}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Password Feedback Alerts */}
            {pwdError && (
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                color: '#065f46',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={18} />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwdLoading}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                border: 'none',
                cursor: pwdLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <KeyRound size={16} />
              <span>{pwdLoading ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </form>
        </div>
      </div>
    </CustomerPortalLayout>
  );
};
