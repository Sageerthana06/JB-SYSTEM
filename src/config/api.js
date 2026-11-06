const envUrl = import.meta.env.VITE_API_URL;
const baseOrigin = (envUrl && !envUrl.includes('trycloudflare.com'))
  ? String(envUrl).trim().replace(/\/api\/?$/i, '').replace(/\/+$/, '')
  : 'http://localhost:5000';

export const API_URL = baseOrigin;
export const API_BASE = `${baseOrigin}/api`;

export const getApiUrl = (endpoint = '') => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_URL}${cleanEndpoint}`;
};

export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_URL}${cleanPath}`;
};

export const fetchAuthenticatedSlipBlobUrl = async (imagePath) => {
  if (!imagePath) return null;
  const fullUrl = getImageUrl(imagePath);
  const token = localStorage.getItem('jb_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
  const response = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    throw new Error(`Failed to load payment slip (${response.status})`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
