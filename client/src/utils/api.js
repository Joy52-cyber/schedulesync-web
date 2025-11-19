import axios from 'axios';

// Determine API URL - Clean and simple
const getApiUrl = () => {
  const viteUrl = import.meta.env.VITE_API_URL;
  
  if (viteUrl) {
    // Remove trailing slash and /api suffix if present
    return viteUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  }
  
  // Fallback for local development
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
  // Production fallback
  return window.location.origin;
};

const API_BASE = getApiUrl();
const API_URL = `${API_BASE}/api`;

console.log('🔌 API Configuration:', { 
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE,
  API_URL 
});

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
    console.log('🔑 Adding token to request:', config.url);
  }
  return config;
});

// Handle 401 errors
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

export const googleLogin = auth.googleLogin;

export const getOrganizerOAuthUrl = async () => {
  const response = await apiClient.get('/auth/google/url');
  return response.data;
};

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
  
  // ⭐ NEW: Slots endpoint for SmartSlotPicker
  getSlots: (token, data) => 
    apiClient.post(`/book/${encodeURIComponent(token)}/slots-with-status`, data),
  
  // Management endpoints (no auth required - use axios directly)
  getByManagementToken: (token) => 
    axios.get(`${API_URL}/bookings/manage/${token}`),
  rescheduleByToken: (token, data) => 
    axios.post(`${API_URL}/bookings/manage/${token}/reschedule`, data),
  cancelByToken: (token, data) => 
    axios.post(`${API_URL}/bookings/manage/${token}/cancel`, data),
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

// ============================================
// AVAILABILITY API
// ============================================

export const availability = {
  get: (memberId) => apiClient.get(`/team-members/${memberId}/availability`),
  update: (memberId, data) => apiClient.put(`/team-members/${memberId}/availability`, data),
};

// ============================================
// USER API
// ============================================

export const user = {
  getTimezone: () => apiClient.get('/user/timezone'),
  updateTimezone: (timezone) => apiClient.put('/user/timezone', { timezone }),
};

// ============================================
// REMINDERS API
// ============================================

export const reminders = {
  getStatus: () => apiClient.get('/reminders/status'),
  sendManual: () => apiClient.post('/admin/send-reminders'),
};

// Export API_URL for components that need it
export { API_URL };

// Default export
export default apiClient;