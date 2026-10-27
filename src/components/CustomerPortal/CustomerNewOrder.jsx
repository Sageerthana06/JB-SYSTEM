import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../utils/router';
import { CustomerPortalLayout } from './CustomerPortalLayout';
import { API_URL, getImageUrl } from '../../config/api';
import { ImageUploadCapture } from '../common/ImageUploadCapture';
import { CameraCaptureModal } from '../common/CameraCaptureModal';
import { validateImageFileClient, ACCEPT_IMAGE_INPUT_STRING } from '../../utils/imageUploadHelper';
import {
  DRESS_TYPE_OPTIONS,
  getMeasurementsForDressType
} from '../../config/tailoringMeasurements';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Scissors,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
  Camera,
  User,
  Ruler,
  Clock,
  Check,
  Edit3,
  Layers
} from 'lucide-react';

export const CustomerNewOrder = () => {
  const { getAuthHeaders } = useAuth();
  const { navigate } = useRouter();

  // Wizard Step State (1: Customer, 2: Garment, 3: Measurements, 4: Work, 5: Design, 6: Review)
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Customer Details
  const [customerData, setCustomerData] = useState({
    name: '',
    primaryPhone: '',
    alternativePhone: '',
    address: '',
    profilePhoto: ''
  });
  const [customerPhotoFile, setCustomerPhotoFile] = useState(null);
  const [customerPhotoPreview, setCustomerPhotoPreview] = useState(null);
  const [uploadingCustomerPhoto, setUploadingCustomerPhoto] = useState(false);

  // Step 2: Garment & Style Specification
  const [garmentData, setGarmentData] = useState({
    dressType: 'Saree Blouse',
    quantity: 1,
    occasion: 'Wedding / Bridal',
    fabricSuppliedBy: 'Customer',
    fabricType: '',
    fabricColour: ''
  });

  // Step 3: Dynamic Tailoring Measurements
  const [measurementUnit, setMeasurementUnit] = useState('Inches'); // 'Inches' | 'CM'
  const [fitPreference, setFitPreference] = useState('Regular'); // 'Tight' | 'Regular' | 'Loose'
  const [takenBy, setTakenBy] = useState('Customer'); // 'Customer' | 'Bella Design Staff'
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
  const [measurements, setMeasurements] = useState({});
  const [fittingInstructions, setFittingInstructions] = useState('');
  const [previousLoadedMsg, setPreviousLoadedMsg] = useState('');
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  // Step 4: Tailoring Options & Work Requirements
  const [tailoringData, setTailoringData] = useState({
    liningRequired: true,
    paddingCupRequired: false,
    workRequired: false,
    workDetails: '',
    accessoriesSupplied: '',
    specialDesignInstructions: ''
  });

  // Step 5: Design Reference Photos
  const [designReferenceImage, setDesignReferenceImage] = useState('');
  const [designReferencePreview, setDesignReferencePreview] = useState(null);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [additionalImages, setAdditionalImages] = useState([]); // array of URLs
  const [uploadingAdditional, setUploadingAdditional] = useState(false);
  const [isAdditionalCameraOpen, setIsAdditionalCameraOpen] = useState(false);

  // System & Flow State
  const [_loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Occasions list
  const occasions = [
    'Wedding / Bridal',
    'Reception / Party',
    'Engagement',
    'Festival / Religious',
    'Formal Event',
    'Casual / Everyday'
  ];

  // 1. Fetch current customer profile on mount
  useEffect(() => {
    fetch(`${API_URL}/api/customer-portal/me`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.customer) {
          setCustomerData({
            name: data.customer.name || '',
            primaryPhone: data.customer.primaryPhone || '',
            alternativePhone: data.customer.alternativePhone || '',
            address: data.customer.address || '',
            profilePhoto: data.customer.profilePhoto || ''
          });
        }
      })
      .catch(err => console.error('Failed to load customer profile:', err))
      .finally(() => setLoadingProfile(false));
  }, [getAuthHeaders]);

  // Handle Customer Photo selection & upload (20 MB limit)
  const handleCustomerPhotoSelect = async (fileOrEvent) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files?.[0] : fileOrEvent;
    if (!file) return;

    const validation = validateImageFileClient(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setCustomerPhotoFile(file);
    setCustomerPhotoPreview(URL.createObjectURL(file));
    setError('');

    // Immediate server upload
    setUploadingCustomerPhoto(true);
    const formData = new FormData();
    formData.append('customerPhoto', file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: formData
      });
      const data = await res.json();
      setUploadingCustomerPhoto(false);

      if (data.success && (data.photoUrl || data.imageUrl)) {
        const photoUrl = data.photoUrl || data.imageUrl;
        setCustomerData(prev => ({ ...prev, profilePhoto: photoUrl }));
      } else {
        setError(data.message || 'Customer photo upload failed.');
      }
    } catch {
      setUploadingCustomerPhoto(false);
      setError('Error connecting to upload server.');
    }
  };

  // Handle Design Reference Image upload (20 MB limit)
  const handleDesignImageSelect = async (fileOrEvent) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files?.[0] : fileOrEvent;
    if (!file) return;

    const validation = validateImageFileClient(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setDesignReferencePreview(URL.createObjectURL(file));
    setUploadingDesign(true);
    setError('');

    const formData = new FormData();
    formData.append('designImage', file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: formData
      });
      const data = await res.json();
      setUploadingDesign(false);

      if (data.success && (data.imageUrl || data.photoUrl)) {
        setDesignReferenceImage(data.imageUrl || data.photoUrl);
      } else {
        setError(data.message || 'Design reference upload failed.');
      }
    } catch {
      setUploadingDesign(false);
      setError('Error uploading design reference image.');
    }
  };

  // Handle Additional Reference Photos upload (20 MB limit per photo)
  const handleAdditionalImageSelect = async (fileOrEvent) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files?.[0] : fileOrEvent;
    if (!file) return;

    const validation = validateImageFileClient(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setUploadingAdditional(true);
    setError('');

    const formData = new FormData();
    formData.append('designImage', file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: formData
      });
      const data = await res.json();
      setUploadingAdditional(false);

      if (data.success && (data.imageUrl || data.photoUrl)) {
        setAdditionalImages(prev => [...prev, data.imageUrl || data.photoUrl]);
      } else {
        setError(data.message || 'Failed to upload additional reference.');
      }
    } catch {
      setUploadingAdditional(false);
      setError('Error uploading additional photo.');
    }
  };

  const handleRemoveAdditionalImage = (indexToRemove) => {
    setAdditionalImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle measurement field changes
  const handleMeasurementChange = (key, val) => {
    setMeasurements(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Load Previous Measurements feature
  const handleLoadPreviousMeasurements = async () => {
    setLoadingPrevious(true);
    setPreviousLoadedMsg('');
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/customer-portal/measurements/latest?dressType=${encodeURIComponent(garmentData.dressType)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setLoadingPrevious(false);

      if (data.success && data.measurement) {
        const prev = data.measurement;
        if (prev.measurements && typeof prev.measurements === 'object') {
          setMeasurements(prev.measurements);
        }
        if (prev.measurementUnit) setMeasurementUnit(prev.measurementUnit);
        if (prev.fitPreference) setFitPreference(prev.fitPreference);
        if (prev.fittingInstructions) setFittingInstructions(prev.fittingInstructions);

        const dateStr = prev.measurementDate ? new Date(prev.measurementDate).toLocaleDateString() : 'earlier order';
        setPreviousLoadedMsg(`✓ Successfully loaded compatible previous measurements from ${dateStr} (${prev.measurementUnit || 'Inches'}, ${prev.fitPreference || 'Regular'} Fit). You may adjust any values below.`);
      } else {
        setPreviousLoadedMsg('No previous measurements available for this dress type.');
      }
    } catch {
      setLoadingPrevious(false);
      setError('Failed to fetch previous measurements from server.');
    }
  };

  // Validate step before advancing
  const validateStep = (step) => {
    setError('');
    if (step === 1) {
      if (!customerData.name || !customerData.name.trim()) {
        setError('Customer Name is required.');
        return false;
      }
      if (!customerData.primaryPhone || !customerData.primaryPhone.trim()) {
        setError('Primary WhatsApp / Contact is required.');
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!garmentData.dressType) {
        setError('Dress Type is required.');
        return false;
      }
      if (parseInt(garmentData.quantity) < 1 || isNaN(parseInt(garmentData.quantity))) {
        setError('Quantity must be at least 1.');
        return false;
      }
      return true;
    }

    if (step === 3) {
      const fieldConfigs = getMeasurementsForDressType(garmentData.dressType);
      for (const field of fieldConfigs) {
        if (field.required && !field.isText && !field.isTextarea) {
          const val = measurements[field.key];
          if (val === undefined || val === null || val === '') {
            setError(`Please provide measurement for ${field.label}.`);
            return false;
          }
          const num = Number(val);
          if (isNaN(num) || num < 0) {
            setError(`Invalid value for ${field.label}. Must be a non-negative number.`);
            return false;
          }
        }
      }
      return true;
    }

    if (step === 4) {
      if (tailoringData.workRequired && !tailoringData.workDetails.trim()) {
        setError('Please provide Hand Embroidery / Aari Work details.');
        return false;
      }
      return true;
    }

    if (step === 5) {
      if (!designReferenceImage) {
        setError('Primary Design Reference Photo is required.');
        return false;
      }
      return true;
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setError('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpToStep = (stepNumber) => {
    setError('');
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Order Submission
  const handleSubmitOrder = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(5)) {
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    const payload = {
      customerDetails: {
        name: customerData.name.trim(),
        alternativePhone: customerData.alternativePhone ? customerData.alternativePhone.trim() : null,
        address: customerData.address ? customerData.address.trim() : null,
        profilePhoto: customerData.profilePhoto || null
      },
      garmentDetails: {
        dressType: garmentData.dressType,
        quantity: parseInt(garmentData.quantity) || 1,
        occasion: garmentData.occasion || null,
        fabricSuppliedBy: garmentData.fabricSuppliedBy || null,
        fabricType: garmentData.fabricType || null,
        fabricColour: garmentData.fabricColour || null,
        liningRequired: tailoringData.liningRequired,
        paddingCupRequired: tailoringData.paddingCupRequired,
        workRequired: tailoringData.workRequired,
        workDetails: tailoringData.workDetails || null,
        accessoriesSupplied: tailoringData.accessoriesSupplied || null,
        specialDesignInstructions: tailoringData.specialDesignInstructions || null,
        designReferenceImage: designReferenceImage,
        additionalImages: additionalImages.length > 0 ? additionalImages : null,
        measurements: measurements,
        measurementUnit: measurementUnit,
        fitPreference: fitPreference,
        takenBy: takenBy,
        measurementDate: measurementDate,
        fittingInstructions: fittingInstructions || null
      },
      orderSource: 'ONLINE'
    };

    try {
      const res = await fetch(`${API_URL}/api/customer-portal/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSubmitting(false);

      if (data.success && data.order) {
        setSuccessMsg(`Order ${data.order.orderNumber} placed successfully! Our master tailor and pricing manager will review your bespoke specifications.`);
        setTimeout(() => {
          navigate('/customer/orders');
        }, 2200);
      } else {
        setError(data.message || 'Failed to submit bespoke custom order.');
      }
    } catch {
      setSubmitting(false);
      setError('Network error submitting your tailoring order.');
    }
  };

  const activeFields = getMeasurementsForDressType(garmentData.dressType);

  const stepLabels = [
    { num: 1, label: 'Customer' },
    { num: 2, label: 'Garment' },
    { num: 3, label: 'Measurements' },
    { num: 4, label: 'Work Options' },
    { num: 5, label: 'Design' },
    { num: 6, label: 'Review' }
  ];

  return (
    <CustomerPortalLayout activePage="new-order">
      <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '60px' }}>

        {/* Header Title Banner */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#0052cc',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '6px'
          }}>
            <Sparkles size={14} />
            <span>Customer Studio • Bespoke Custom Tailoring</span>
          </div>
          <h1 style={{
            fontSize: '1.85rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 6px 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Create New Custom Order
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Precision measurements, style options, and design references saved directly into the master tailoring vault.
          </p>
        </div>

        {/* 6-Step Progress Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '14px 20px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          overflowX: 'auto',
          gap: '8px'
        }}>
          {stepLabels.map((s, idx) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <React.Fragment key={s.num}>
                <div
                  onClick={() => s.num < currentStep && jumpToStep(s.num)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: s.num < currentStep ? 'pointer' : 'default',
                    opacity: s.num <= currentStep ? 1 : 0.45,
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#10b981' : (isCurrent ? '#0052cc' : '#e2e8f0'),
                    color: isCompleted || isCurrent ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 900
                  }}>
                    {isCompleted ? <Check size={14} /> : s.num}
                  </div>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? '#0052cc' : '#334155'
                  }}>
                    {s.label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    backgroundColor: currentStep > s.num ? '#10b981' : '#e2e8f0',
                    minWidth: '12px'
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '0.88rem',
            fontWeight: 700
          }}>
            <AlertCircle size={18} flexShrink={0} />
            <span>{error}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#dcfce7',
            color: '#15803d',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            fontWeight: 800
          }}>
            <CheckCircle2 size={20} flexShrink={0} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '32px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}>

          {/* ================= STEP 1: CUSTOMER DETAILS ================= */}
          {currentStep === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <User size={22} color="#0052cc" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    1. Customer Profile Details
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Confirm your primary contact and profile photo for this tailoring order.
                  </p>
                </div>
              </div>

              {/* Customer Photo Upload Section */}
              <div style={{ marginBottom: '24px' }}>
                <ImageUploadCapture
                  label="Customer Photo"
                  sublabel="Upload a portrait photo or take a photo with your camera (Max 20 MB • JPG, PNG, WebP, GIF, BMP)"
                  currentImageUrl={customerData.profilePhoto ? getImageUrl(customerData.profilePhoto) : null}
                  previewUrl={customerPhotoPreview}
                  file={customerPhotoFile}
                  onFileSelected={handleCustomerPhotoSelect}
                  onFileRemoved={() => {
                    setCustomerPhotoFile(null);
                    setCustomerPhotoPreview(null);
                  }}
                  isUploading={uploadingCustomerPhoto}
                  onError={(err) => setError(err)}
                  cameraTitle="Take Customer Photo"
                  compact={false}
                />
              </div>

              {/* Customer Text Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Customer Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                    placeholder="e.g. name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Primary WhatsApp / Mobile <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={customerData.primaryPhone}
                    onChange={(e) => setCustomerData({ ...customerData, primaryPhone: e.target.value })}
                    placeholder="e.g. +9477XXXXXXX"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Alternative Contact Number
                  </label>
                  <input
                    type="text"
                    value={customerData.alternativePhone}
                    onChange={(e) => setCustomerData({ ...customerData, alternativePhone: e.target.value })}
                    placeholder="e.g. 071XXXXXXX (Optional)"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Fitting Delivery Address / City
                  </label>
                  <input
                    type="text"
                    value={customerData.address}
                    onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                    placeholder="e.g. Colombo 06"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: GARMENT & STYLE SPECIFICATION ================= */}
          {currentStep === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <Scissors size={22} color="#0052cc" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    2. Garment & Style Specification
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Select your garment type to automatically load tailored measurement parameters.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {/* Dress Type */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Dress Type <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    value={garmentData.dressType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setGarmentData({ ...garmentData, dressType: newType });
                      setPreviousLoadedMsg('');
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  >
                    {DRESS_TYPE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Quantity <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={garmentData.quantity}
                    onChange={(e) => setGarmentData({ ...garmentData, quantity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Occasion */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Occasion / Event
                  </label>
                  <select
                    value={garmentData.occasion}
                    onChange={(e) => setGarmentData({ ...garmentData, occasion: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      outline: 'none'
                    }}
                  >
                    {occasions.map(occ => (
                      <option key={occ} value={occ}>{occ}</option>
                    ))}
                  </select>
                </div>

                {/* Fabric Supplied By */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Fabric Supplied By
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['Customer', 'Bella Design'].map(supplier => (
                      <label key={supplier} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: garmentData.fabricSuppliedBy === supplier ? '2px solid #0052cc' : '1px solid #cbd5e1',
                        backgroundColor: garmentData.fabricSuppliedBy === supplier ? '#eff6ff' : '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        flex: 1
                      }}>
                        <input
                          type="radio"
                          name="fabricSuppliedBy"
                          value={supplier}
                          checked={garmentData.fabricSuppliedBy === supplier}
                          onChange={(e) => setGarmentData({ ...garmentData, fabricSuppliedBy: e.target.value })}
                          style={{ display: 'none' }}
                        />
                        <span>{supplier === 'Customer' ? 'Provided by Customer' : 'Sourced by Studio'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Fabric Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Fabric Type / Material
                  </label>
                  <input
                    type="text"
                    value={garmentData.fabricType}
                    onChange={(e) => setGarmentData({ ...garmentData, fabricType: e.target.value })}
                    placeholder="e.g. Pure Kanchipuram Silk, Georgette, Velvet"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Fabric Colour */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Fabric Colour / Shade
                  </label>
                  <input
                    type="text"
                    value={garmentData.fabricColour}
                    onChange={(e) => setGarmentData({ ...garmentData, fabricColour: e.target.value })}
                    placeholder="e.g. Deep Maroon, Peacock Blue, Antique Gold"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: DYNAMIC TAILORING MEASUREMENTS ================= */}
          {currentStep === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Ruler size={22} color="#0052cc" />
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      3. Tailoring Measurements ({garmentData.dressType})
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      Bespoke sizing parameters configured specifically for {garmentData.dressType}.
                    </p>
                  </div>
                </div>

                {/* Use Previous Measurements Trigger */}
                <button
                  type="button"
                  onClick={handleLoadPreviousMeasurements}
                  disabled={loadingPrevious}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    color: '#1d4ed8',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: loadingPrevious ? 'wait' : 'pointer'
                  }}
                >
                  <Clock size={14} />
                  <span>{loadingPrevious ? 'Checking Vault...' : 'Use Previous Measurements'}</span>
                </button>
              </div>

              {/* Previous Measurements Alert Banner */}
              {previousLoadedMsg && (
                <div style={{
                  backgroundColor: previousLoadedMsg.startsWith('✓') ? '#eff6ff' : '#fffbeb',
                  color: previousLoadedMsg.startsWith('✓') ? '#1e40af' : '#b45309',
                  border: `1.5px solid ${previousLoadedMsg.startsWith('✓') ? '#bfdbfe' : '#fde68a'}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}>
                  {previousLoadedMsg}
                </div>
              )}

              {/* Sizing Parameters Header Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px'
              }}>
                {/* Measurement Unit */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Measurement Unit
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['Inches', 'CM'].map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setMeasurementUnit(u)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          border: measurementUnit === u ? '2px solid #0052cc' : '1px solid #cbd5e1',
                          backgroundColor: measurementUnit === u ? '#0052cc' : '#ffffff',
                          color: measurementUnit === u ? '#ffffff' : '#334155'
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fit Preference */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Fit Preference
                  </label>
                  <select
                    value={fitPreference}
                    onChange={(e) => setFitPreference(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Tight">Tight / Bodycon</option>
                    <option value="Regular">Regular / Comfort</option>
                    <option value="Loose">Loose / Relaxed</option>
                  </select>
                </div>

                {/* Taken By */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Measurement Taken By
                  </label>
                  <select
                    value={takenBy}
                    onChange={(e) => setTakenBy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Bella Design Staff">Bella Design Staff</option>
                  </select>
                </div>

                {/* Measurement Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Measurement Date
                  </label>
                  <input
                    type="date"
                    value={measurementDate}
                    onChange={(e) => setMeasurementDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Measurement Inputs Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {activeFields.map(field => {
                  if (field.isTextarea) {
                    return (
                      <div key={field.key} style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                        </label>
                        <textarea
                          rows="3"
                          value={measurements[field.key] || ''}
                          onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    );
                  }

                  if (field.isText) {
                    return (
                      <div key={field.key} style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                        </label>
                        <input
                          type="text"
                          value={measurements[field.key] || ''}
                          onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.88rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={field.key}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={measurements[field.key] || ''}
                          onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            width: '100%',
                            padding: '10px 42px 10px 12px',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        <span style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#64748b'
                        }}>
                          {measurementUnit === 'Inches' ? 'in' : 'cm'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Special Fitting Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Special Fitting Instructions / Body Notes (Optional)
                </label>
                <textarea
                  rows="3"
                  value={fittingInstructions}
                  onChange={(e) => setFittingInstructions(e.target.value)}
                  placeholder="e.g. Sloping shoulders, deep front cut requested, extra comfort around armholes..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* ================= STEP 4: TAILORING OPTIONS & WORK REQUIREMENTS ================= */}
          {currentStep === 4 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <Layers size={22} color="#0052cc" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    4. Tailoring & Work Requirements
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Select bespoke lining, cup padding, hand embroidery, and accessory parameters.
                  </p>
                </div>
              </div>

              {/* Toggles Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Lining */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Lining Required</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Inner cotton/crepe lining</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => setTailoringData({ ...tailoringData, liningRequired: val })}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          border: tailoringData.liningRequired === val ? '2px solid #0052cc' : '1px solid #cbd5e1',
                          backgroundColor: tailoringData.liningRequired === val ? '#0052cc' : '#ffffff',
                          color: tailoringData.liningRequired === val ? '#ffffff' : '#475569'
                        }}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Padding / Cup */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Padding / Cup Required</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Built-in padded cups</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => setTailoringData({ ...tailoringData, paddingCupRequired: val })}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          border: tailoringData.paddingCupRequired === val ? '2px solid #0052cc' : '1px solid #cbd5e1',
                          backgroundColor: tailoringData.paddingCupRequired === val ? '#0052cc' : '#ffffff',
                          color: tailoringData.paddingCupRequired === val ? '#ffffff' : '#475569'
                        }}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hand Embroidery / Aari Work */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Aari / Hand Embroidery</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Custom artisan needlework</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => setTailoringData({ ...tailoringData, workRequired: val })}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          border: tailoringData.workRequired === val ? '2px solid #0052cc' : '1px solid #cbd5e1',
                          backgroundColor: tailoringData.workRequired === val ? '#0052cc' : '#ffffff',
                          color: tailoringData.workRequired === val ? '#ffffff' : '#475569'
                        }}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Work Details (shown if workRequired is Yes) */}
              {tailoringData.workRequired && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Hand Embroidery / Aari Work Specifications <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    rows="3"
                    value={tailoringData.workDetails}
                    onChange={(e) => setTailoringData({ ...tailoringData, workDetails: e.target.value })}
                    placeholder="Specify zari, beadwork, sequence, neck border motif details..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Accessories Supplied */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Accessories Supplied / Requested
                </label>
                <input
                  type="text"
                  value={tailoringData.accessoriesSupplied}
                  onChange={(e) => setTailoringData({ ...tailoringData, accessoriesSupplied: e.target.value })}
                  placeholder="e.g. Designer buttons, latkans, back hooks, concealed zipper"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Special Design Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Special Design Instructions
                </label>
                <textarea
                  rows="3"
                  value={tailoringData.specialDesignInstructions}
                  onChange={(e) => setTailoringData({ ...tailoringData, specialDesignInstructions: e.target.value })}
                  placeholder="e.g. Cut back neck in sweet-heart shape, add double piping along sleeve hem..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* ================= STEP 5: DESIGN REFERENCES ================= */}
          {currentStep === 5 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <ImageIcon size={22} color="#0052cc" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    5. Design Reference Photos
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Upload your primary inspiration photo and any additional reference images.
                  </p>
                </div>
              </div>

              {/* Primary Design Reference (Mandatory) */}
              <div style={{ marginBottom: '28px' }}>
                <ImageUploadCapture
                  label="Primary Design Reference Photo"
                  sublabel="Upload customer design sketch, sample garment, embroidery pattern, or take a picture with camera (Max 20 MB • JPG, PNG, WebP, GIF, BMP)"
                  currentImageUrl={designReferenceImage ? getImageUrl(designReferenceImage) : null}
                  previewUrl={designReferencePreview}
                  onFileSelected={handleDesignImageSelect}
                  onFileRemoved={() => {
                    setDesignReferenceImage('');
                    setDesignReferencePreview(null);
                  }}
                  isUploading={uploadingDesign}
                  onError={(err) => setError(err)}
                  cameraTitle="Take Design Reference Photo"
                  required={true}
                />
              </div>

              {/* Additional Reference Photos */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                      Additional Reference Photos (Optional)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Add up to 5 additional design, fabric, or alteration reference photos (Max 20 MB each)
                    </span>
                  </div>

                  {additionalImages.length < 5 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#1d4ed8',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: uploadingAdditional ? 'wait' : 'pointer'
                      }}>
                        <Upload size={14} />
                        <span>{uploadingAdditional ? 'Uploading...' : 'Upload Image'}</span>
                        <input
                          type="file"
                          accept={ACCEPT_IMAGE_INPUT_STRING}
                          onChange={handleAdditionalImageSelect}
                          disabled={uploadingAdditional}
                          style={{ display: 'none' }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsAdditionalCameraOpen(true)}
                        disabled={uploadingAdditional}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#2563eb',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: uploadingAdditional ? 'wait' : 'pointer'
                        }}
                      >
                        <Camera size={14} />
                        <span>Take Photo</span>
                      </button>
                    </div>
                  )}
                </div>

                <CameraCaptureModal
                  isOpen={isAdditionalCameraOpen}
                  onClose={() => setIsAdditionalCameraOpen(false)}
                  onCapture={handleAdditionalImageSelect}
                  title="Take Additional Reference Photo"
                />

                {additionalImages.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    {additionalImages.map((imgUrl, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #cbd5e1' }}>
                        <img
                          src={getImageUrl(imgUrl)}
                          alt={`Reference ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(220, 38, 38, 0.85)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Remove Photo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    No additional reference photos added yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 6: ORDER REVIEW BEFORE SUBMISSION ================= */}
          {currentStep === 6 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <CheckCircle2 size={22} color="#10b981" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    6. Order Review & Verification
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Please verify your custom tailoring specifications before submitting.
                  </p>
                </div>
              </div>

              {/* Review Sections Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>

                {/* 1. Customer Summary */}
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0052cc', textTransform: 'uppercase' }}>
                      Customer Profile
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToStep(1)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#0052cc', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#0a192f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                      {customerData.profilePhoto ? (
                        <img src={getImageUrl(customerData.profilePhoto)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        customerData.name?.charAt(0) || <User size={24} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{customerData.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {customerData.primaryPhone} {customerData.alternativePhone && ` • Alt: ${customerData.alternativePhone}`}
                      </div>
                      {customerData.address && (
                        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>{customerData.address}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Garment & Style Summary */}
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0052cc', textTransform: 'uppercase' }}>
                      Garment & Style
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToStep(2)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#0052cc', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                    <div><strong>Dress Type:</strong> {garmentData.dressType}</div>
                    <div><strong>Quantity:</strong> {garmentData.quantity}</div>
                    <div><strong>Occasion:</strong> {garmentData.occasion || '—'}</div>
                    <div><strong>Fabric Source:</strong> {garmentData.fabricSuppliedBy}</div>
                    <div><strong>Fabric Type:</strong> {garmentData.fabricType || '—'}</div>
                    <div><strong>Colour:</strong> {garmentData.fabricColour || '—'}</div>
                  </div>
                </div>

                {/* 3. Measurements Summary */}
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0052cc', textTransform: 'uppercase' }}>
                        Measurements ({measurementUnit})
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '10px' }}>
                        Fit: <strong>{fitPreference}</strong> • Taken By: <strong>{takenBy}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => jumpToStep(3)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#0052cc', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '0.82rem' }}>
                    {activeFields.map(f => {
                      const val = measurements[f.key];
                      if (!val) return null;
                      return (
                        <div key={f.key} style={{ backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{f.label}:</span>{' '}
                          <strong>{val} {f.isText || f.isTextarea ? '' : (measurementUnit === 'Inches' ? 'in' : 'cm')}</strong>
                        </div>
                      );
                    })}
                  </div>

                  {fittingInstructions && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '8px', backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <strong>Fitting Notes:</strong> {fittingInstructions}
                    </div>
                  )}
                </div>

                {/* 4. Work Options Summary */}
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0052cc', textTransform: 'uppercase' }}>
                      Tailoring Options & Work
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToStep(4)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#0052cc', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                    <div><strong>Lining:</strong> {tailoringData.liningRequired ? 'Yes' : 'No'}</div>
                    <div><strong>Padding / Cup:</strong> {tailoringData.paddingCupRequired ? 'Yes' : 'No'}</div>
                    <div><strong>Aari / Embroidery:</strong> {tailoringData.workRequired ? 'Yes' : 'No'}</div>
                    {tailoringData.accessoriesSupplied && <div><strong>Accessories:</strong> {tailoringData.accessoriesSupplied}</div>}
                  </div>
                  {tailoringData.workRequired && tailoringData.workDetails && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '8px' }}>
                      <strong>Work Details:</strong> {tailoringData.workDetails}
                    </div>
                  )}
                  {tailoringData.specialDesignInstructions && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
                      <strong>Special Instructions:</strong> {tailoringData.specialDesignInstructions}
                    </div>
                  )}
                </div>

                {/* 5. Design Reference Summary */}
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0052cc', textTransform: 'uppercase' }}>
                      Design References
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToStep(5)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#0052cc', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {designReferenceImage && (
                      <div style={{ textAlign: 'center' }}>
                        <img
                          src={getImageUrl(designReferenceImage)}
                          alt="Primary Reference"
                          style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #0052cc' }}
                        />
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0052cc', marginTop: '2px' }}>Primary</div>
                      </div>
                    )}
                    {additionalImages.map((img, idx) => (
                      <div key={idx} style={{ textAlign: 'center' }}>
                        <img
                          src={getImageUrl(img)}
                          alt={`Additional ${idx + 1}`}
                          style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                        />
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Ref {idx + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Action Buttons Navigation Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1.5px solid #f1f5f9',
            paddingTop: '20px',
            marginTop: '20px'
          }}>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={nextStep}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0052cc',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 82, 204, 0.25)'
                }}
              >
                <span>Continue to Step {currentStep + 1}</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  cursor: submitting ? 'wait' : 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Sparkles size={18} />
                <span>{submitting ? 'Submitting Custom Order...' : 'Submit Custom Order'}</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </CustomerPortalLayout>
  );
};
