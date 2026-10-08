import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CustomerPortalLayout } from './CustomerPortalLayout';
import { API_URL, getImageUrl } from '../../config/api';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Camera,
  X
} from 'lucide-react';

export const CustomerProfile = () => {
  const { user, getAuthHeaders } = useAuth();

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

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Photo must be 5MB or smaller.');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
        setErrorMsg('Invalid format. Only JPG, JPEG, PNG, and WEBP are supported.');
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
    } catch (err) {
      setSaving(false);
      setErrorMsg('Network error updating profile.');
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <div style={{ position: 'relative', width: '76px', height: '76px', flexShrink: 0 }}>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6' }}
                  />
                ) : formData.profilePhoto ? (
                  <img
                    src={getImageUrl(formData.profilePhoto)}
                    alt="Customer Photo"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #cbd5e1' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    backgroundColor: '#0a192f',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    fontWeight: 900
                  }}>
                    {formData.name?.charAt(0) || <User size={36} />}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '4px' }}>
                  Customer Profile Photo
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>
                  Upload a clear portrait photo (JPG, JPEG, PNG, or WEBP up to 5MB).
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    color: '#1e40af',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <Camera size={14} />
                    <span>{photoPreview ? 'Change Selection' : (formData.profilePhoto ? 'Replace Photo' : 'Upload Photo')}</span>
                    <input
                      type="file"
                      accept="image/jpeg, image/png, image/webp, image/jpg"
                      onChange={handlePhotoSelect}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveSelectedPhoto}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <X size={13} /> Cancel
                    </button>
                  )}
                </div>
              </div>
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
      </div>
    </CustomerPortalLayout>
  );
};
