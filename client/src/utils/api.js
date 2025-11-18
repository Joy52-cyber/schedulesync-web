import axios from 'axios';

// Determine API URL
const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`);

// Remove any trailing slashes and ensure /api is not doubled
const API_URL = API_BASE.replace(/\/+$/, '').replace(/\/api\/api/, '/api');

console.log('🔌 API URL:', API_URL);

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 
    'Content-Type': 'application/json' 
  },
});

// Add auth interceptor - Automatically add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('🔑 Adding token to request:', config.url);
  }
  return config;
});

// Handle 401 errors - Auto logout on expired token
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - Token expired, logging out');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================

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
  getCurrentUser: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

// Export googleLogin standalone for backwards compatibility
export const googleLogin = auth.googleLogin;

// Get Google OAuth URL for organizer calendar connection
export const getOrganizerOAuthUrl = async () => {
  const response = await apiClient.get('/auth/google/url');
  return response.data;
};

// Handle organizer OAuth callback
export const handleOrganizerOAuthCallback = async (code) => {
  const response = await apiClient.post('/auth/google/callback', { code });
  return response.data;
};

// ============================================
// TEAMS API
// ============================================

export const teams = {
  getAll: () => apiClient.get('/teams'),
  create: (data) => apiClient.post('/teams', data),
  update: (id, data) => apiClient.put(`/teams/${id}`, data),
  delete: (id) => apiClient.delete(`/teams/${id}`),
  getMembers: (teamId) => apiClient.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => apiClient.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId, memberId) => apiClient.delete(`/teams/${teamId}/members/${memberId}`),
  updateMemberExternalLink: (teamId, memberId, data) => 
    apiClient.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

// ============================================
// BOOKINGS API
// ============================================

export const bookings = {
  getAll: () => apiClient.get('/bookings'),
  getByToken: (token) => apiClient.get(`/book/${encodeURIComponent(token)}`),
  create: (data) => apiClient.post('/bookings', data),
  getAvailability: (token, date) => 
    apiClient.get(`/book/${encodeURIComponent(token)}/availability`, { 
      params: { date } 
    }),
};

// ============================================
// ANALYTICS API
// ============================================

export const analytics = {
  getStats: () => Promise.resolve({ 
    totalUsers: 0, 
    totalBookings: 0 
  }),
};

// Default export the axios instance
export default apiClient;