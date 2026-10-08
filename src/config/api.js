const envUrl = import.meta.env.VITE_API_URL;
export const API_URL = (envUrl && !envUrl.includes('trycloudflare.com')) ? envUrl : 'http://localhost:5000';
export const API_BASE = `${API_URL}/api`;

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
