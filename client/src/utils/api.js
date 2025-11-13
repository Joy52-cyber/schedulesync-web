// client/src/utils/api.js
// BULLETPROOF VERSION - Works with all bundlers
import axios from 'axios';

// Determine API URL
const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`);

// Remove any trailing slashes and ensure /api is not doubled
const API_URL = API_BASE.replace(/\/+$/, '').replace(/\/api\/api/, '/api');

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 
    'Content-Type': 'application/json' 
  },
});

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================
// CRITICAL: Define googleLogin as standalone function first
// This ensures it's always available for import
// ============================================
function googleLogin(codeOrPayload) {
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
}

// Export the function directly
export { googleLogin };

// Also include in auth object for backwards compatibility
export const auth = {
  googleLogin,
  getCurrentUser: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

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

export const bookings = {
  getAll: () => apiClient.get('/bookings'),
  getByToken: (token) => apiClient.get(`/book/${encodeURIComponent(token)}`),
  create: (data) => apiClient.post('/bookings', data),
  getAvailability: (token, date) => 
    apiClient.get(`/book/${encodeURIComponent(token)}/availability`, { 
      params: { date } 
    }),
};

export const analytics = {
  getStats: () => Promise.resolve({ 
    totalUsers: 0, 
    totalBookings: 0 
  }),
};

// Default export the axios instance
const api = apiClient;
export default api;