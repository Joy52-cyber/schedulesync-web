import axios from 'axios';

// ============================================
// BASE URL HANDLING
// ============================================
let rawBaseUrl =
  import.meta.env.VITE_API_URL ||
  'https://schedulesync-web-production.up.railway.app';

// Remove trailing slash
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');

// Ensure .../api suffix
const API_BASE = rawBaseUrl.endsWith('/api')
  ? rawBaseUrl
  : `${rawBaseUrl}/api`;

console.log('🌐 Final API Base URL:', API_BASE);

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

// ============================================
// AUTH
// ============================================
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  verifyEmail: (token) => api.get('/auth/verify-email', { params: { token } }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
  resendVerification: (email) =>
    api.post('/auth/resend-verification', { email }),

  updateProfile: (data) => api.put('/users/profile', data),
};

// ============================================
// TEAMS
// ============================================
export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  get: (id) => api.get(`/teams/${id}`),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),

  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  updateMember: (teamId, memberId, data) =>
    api.patch(`/teams/${teamId}/members/${memberId}`, data),
  removeMember: (teamId, memberId) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),

  updateMemberStatus: (teamId, memberId, is_active) =>
    api.patch(`/teams/${teamId}/members/${memberId}/status`, { is_active }),

  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),

  list: () => api.get('/teams'),
};

// ============================================
// AVAILABILITY
// ============================================
export const availability = {
  getSettings: (_, memberId) =>
    api.get(`/team-members/${memberId}/availability`),

  updateSettings: (_, memberId, data) =>
    api.put(`/team-members/${memberId}/availability`, data),
};

// ============================================
// BOOKINGS
// ============================================
export const bookings = {
  list: (params) => api.get('/bookings', { params }),
  getAll: (params) => api.get('/bookings', { params }),

  getByToken: (token) => api.get(`/book/${token}`),
  getSlots: (token, data) =>
    api.post(`/book/${token}/slots-with-status`, data),

  create: (payload) => api.post('/bookings', payload),

  getManagementDetails: (token) =>
    api.get(`/bookings/manage/${token}`),

  rescheduleByToken: (token, data) =>
    api.post(`/bookings/manage/${token}/reschedule`, data),

  cancelByToken: (token, reason) =>
    api.post(`/bookings/manage/${token}/cancel`, { reason }),
};

// ============================================
// REMINDERS
// ============================================
export const reminders = {
  getSettings: (teamId) => api.get(`/teams/${teamId}/reminder-settings`),
  updateSettings: (teamId, data) =>
    api.put(`/teams/${teamId}/reminder-settings`, data),
  getStatus: () => api.get('/reminders/status'),
};

// ============================================
// OAUTH / CALENDAR
// ============================================
export const calendar = {
  connectGoogle: () => api.get('/auth/google/url'),
  disconnectGoogle: () => api.post('/calendar/google/disconnect'),
  getStatus: () => api.get('/calendar/status'),

  listEvents: (start, end) =>
    api.get(`/calendar/events?start=${start}&end=${end}`),

  syncEvents: () => api.post('/calendar/sync'),
};

export const oauth = {
  getGoogleUrl: () => api.get('/auth/google/url'),
  handleCallback: (code) => api.post('/auth/google/callback', { code }),
  guestGoogleAuth: (code, bookingToken) =>
    api.post('/book/auth/google', { code, bookingToken }),
};

// ============================================
// PAYMENTS
// ============================================
export const payments = {
  getConfig: () => api.get('/payments/config'),
  getPricing: (token) => api.get(`/book/${token}/pricing`),
  createIntent: (data) => api.post('/payments/create-intent', data),
  confirmBooking: (data) => api.post('/payments/confirm-booking', data),
  getPaymentStatus: (id) => api.get(`/payments/status/${id}`),
};

// ============================================
// AI
// ============================================
export const ai = {
  schedule: (message, history) =>
    api.post('/ai/schedule', {
      message,
      conversationHistory: history,
    }),
  confirm: (data) => api.post('/ai/confirm', data),
  suggest: (preferences) => api.post('/ai/suggest', { preferences }),
};

// ============================================
// SINGLE-USE LINKS
// ============================================
export const singleUseLinks = {
  generate: () => api.post('/single-use-links'),
  getRecent: () => api.get('/single-use-links/recent'),
  get: (token) => api.get(`/single-use-links/${token}`),
  revoke: (token) => api.delete(`/single-use-links/${token}`),
};

// ============================================
// EVENT TYPES
// ============================================
export const eventTypes = {
  getAll: () => api.get('/event-types'),
  list: (memberId) => api.get(`/event-types?member_id=${memberId}`),
  create: (data) => api.post('/event-types', data),
  get: (id) => api.get(`/event-types/${id}`),
  update: (id, data) => api.put(`/event-types/${id}`, data),
  delete: (id) => api.delete(`/event-types/${id}`),
  toggle: (id, active) => api.patch(`/event-types/${id}/toggle`, { active }),
};

// ============================================
// ANALYTICS
// ============================================
export const analytics = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getBookingStats: (start, end) =>
    api.get(`/analytics/bookings?start=${start}&end=${end}`),
  getTeamStats: (teamId) => api.get(`/analytics/teams/${teamId}`),
  getMemberStats: (memberId) => api.get(`/analytics/members/${memberId}`),
  exportData: (format = 'csv') =>
    api.get(`/analytics/export?format=${format}`),
};

// ============================================
// NOTIFICATIONS (UPDATED ⭐⭐⭐)
// ============================================
export const notifications = {
  list: () => api.get('/notifications'),
  getUnread: () => api.get('/notifications?unread_only=true'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteRead: () => api.delete('/notifications/read'),
};

// ============================================
// TIMEZONE
// ============================================
export const timezone = {
  get: () => api.get('/user/timezone'),
  update: (tz) => api.put('/user/timezone', { timezone: tz }),
  list: () => api.get('/timezones'),
  detect: () => api.get('/timezones/detect'),
  convert: (from, to, datetime) =>
    api.post('/timezones/convert', { fromTimezone: from, toTimezone: to, datetime }),
};

// ============================================
// USER PROFILE
// ============================================
export const user = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  updatePassword: (data) => api.put('/profile/password', data),
  deleteAccount: () => api.delete('/profile'),
};

// ============================================
// HELPERS
// ============================================
export const isAuthenticated = () => !!localStorage.getItem('token');

export const getCurrentUser = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

export const getErrorMessage = (error) => {
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    'An unexpected error occurred'
  );
};

export const uploadFile = async (file, endpoint) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const downloadFile = async (endpoint, filename) => {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const batchRequest = async (requests) =>
  Promise.all(requests.map((req) => api(req)));

export default api;
