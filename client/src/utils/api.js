import axios from 'axios';

const getApiUrl = () => {
  const viteUrl = import.meta.env.VITE_API_URL;
  if (viteUrl) {
    return viteUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  }
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  return window.location.origin;
};

const API_BASE = getApiUrl();
const API_URL = `${API_BASE}/api`;

console.log('🔌 API Configuration:', { 
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE,
  API_URL 
});

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('🔑 Adding token to request:', config.url);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - Token expired, logging out');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete apiClient.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    } else {
      console.error('🔴 API Error:', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.response?.data?.error || error.message
      });
    }
    return Promise.reject(error);
  }
);

// ✅ COMPLETE AUTH OBJECT WITH ALL METHODS
export const auth = {
  googleLogin: (codeOrPayload) => {
    let payload;
    if (typeof codeOrPayload === 'string') {
      payload = { 
        code: codeOrPayload,
        redirectUri: `${window.location.origin}/login`
      };
    } else {
      payload = codeOrPayload;
    }
    return apiClient.post('/auth/google', payload);
  },
  
  // Email/Password Authentication
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  
  // Password Reset
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
  
  // Email Verification
  verifyEmail: (token) => apiClient.get(`/auth/verify-email?token=${token}`),
  resendVerification: (email) => apiClient.post('/auth/resend-verification', { email }),
  
  // Session
  getCurrentUser: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
  
  // Test User
  createTestUser: () => apiClient.get('/auth/create-test-user'),
};

// Keep other exports...
export const googleLogin = auth.googleLogin;
export const getOrganizerOAuthUrl = async () => {
  const response = await apiClient.get('/auth/google/url');
  return response.data;
};
// ... rest of your exports stay the same

export { API_URL };
export default apiClient;