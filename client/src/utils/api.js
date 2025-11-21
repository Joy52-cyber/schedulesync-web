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

export const teams = {
  getAll: () => apiClient.get('/teams'),
  create: (data) => apiClient.post('/teams', data),
  update: (id, data) => apiClient.put(`/teams/${id}`, data),
  delete: (id) => apiClient.delete(`/teams/${id}`),
  getMembers: (teamId) => apiClient.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => apiClient.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId, memberId) => apiClient.delete(`/teams/${teamId}/members/${memberId}`),
  updateMember: (teamId, memberId, data) => apiClient.patch(`/teams/${teamId}/members/${memberId}`, data),
  updateMemberStatus: (teamId, memberId, isActive) => apiClient.patch(`/teams/${teamId}/members/${memberId}/status`, { is_active: isActive }), // ← ADD THIS LINE
  updateMemberExternalLink: (teamId, memberId, data) => apiClient.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

export const bookings = {
  getAll: () => apiClient.get('/bookings'),
  getByToken: (token) => apiClient.get(`/book/${encodeURIComponent(token)}`),
  create: (data) => apiClient.post('/bookings', data),
  getAvailability: (token, date) => apiClient.get(`/book/${encodeURIComponent(token)}/availability`, { params: { date } }),
  getSlots: (token, data) => apiClient.post(`/book/${encodeURIComponent(token)}/slots-with-status`, data),
  getByManagementToken: (token) => axios.get(`${API_URL}/bookings/manage/${token}`),
  rescheduleByToken: (token, data) => axios.post(`${API_URL}/bookings/manage/${token}/reschedule`, data),
  cancelByToken: (token, data) => axios.post(`${API_URL}/bookings/manage/${token}/cancel`, data),
};

export const analytics = {
  getStats: () => Promise.resolve({ totalUsers: 0, totalBookings: 0 }),
};

export const availability = {
  get: (memberId) => apiClient.get(`/team-members/${memberId}/availability`),
  update: (memberId, data) => apiClient.put(`/team-members/${memberId}/availability`, data),
};

export const user = {
  getTimezone: () => apiClient.get('/user/timezone'),
  updateTimezone: (timezone) => apiClient.put('/user/timezone', { timezone }),
};

export const reminders = {
  getStatus: () => apiClient.get('/reminders/status'),
  sendManual: () => apiClient.post('/admin/send-reminders'),
};

export const aiScheduler = {
  sendMessage: (message, conversationHistory) => 
    apiClient.post('/ai/schedule', { message, conversationHistory }),
  confirmBooking: (bookingData) => 
    apiClient.post('/ai/schedule/confirm', { bookingData }),
};


export { API_URL };
export default apiClient;