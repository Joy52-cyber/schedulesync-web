import axios from 'axios';

// 1. Get the base URL from env or default
let rawBaseUrl =
  import.meta.env.VITE_API_URL ||
  'https://schedulesync-web-production.up.railway.app';

// Remove trailing slash if present
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');

// Ensure we end up with .../api
const API_BASE = rawBaseUrl.endsWith('/api')
  ? rawBaseUrl
  : `${rawBaseUrl}/api`;

console.log('🌐 Final API Base URL:', API_BASE);

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

// ============================================
// AUTH
// ============================================
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  verifyEmail: (token) =>
    api.get('/auth/verify-email', { params: { token } }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
  resendVerification: (email) =>
    api.post('/auth/resend-verification', { email }),

  updateProfile: (data) => api.put('/users/profile', data),

  // ✅ Google OAuth (kept for backwards compatibility)
  getGoogleUrl: () => api.get('/auth/google/url'),
};

// ============================================
// TEAMS & MEMBERS
// ============================================
export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  get: (teamId) => api.get(`/teams/${teamId}`),
  update: (teamId, data) => api.put(`/teams/${teamId}`, data),
  delete: (teamId) => api.delete(`/teams/${teamId}`),

  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId, memberId) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),

  // ✅ FIXED: Single updateMember function for all member updates
  updateMember: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}`, data),

  updateMemberStatus: (teamId, memberId, is_active) =>
    api.patch(`/teams/${teamId}/members/${memberId}/status`, { is_active }),

  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),

  // Alias for compatibility
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
  getSlots: (token, data) => api.post(`/book/${token}/slots-with-status`, data),
  create: (payload) => api.post('/bookings', payload),
  getManagementDetails: (token) => api.get(`/bookings/manage/${token}`),
  rescheduleByToken: (token, data) => api.post(`/bookings/manage/${token}/reschedule`, data),
  cancelByToken: (token, reason) => api.post(`/bookings/manage/${token}/cancel`, { reason }),
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
// CALENDAR
// ============================================
export const calendar = {
  connectGoogle: () => api.get('/auth/google/url'),
  disconnectGoogle: () => api.post('/calendar/google/disconnect'),
  getStatus: () => api.get('/calendar/status'),
  listEvents: (startDate, endDate) =>
    api.get(`/calendar/events?start=${startDate}&end=${endDate}`),
  syncEvents: () => api.post('/calendar/sync'),
};

// ============================================
// OAUTH (Google + Microsoft + Calendly)
// ============================================
export const oauth = {
  // ✅ CORRECT - no /api prefix (baseURL already has it)
  getGoogleGuestUrl: (bookingToken) =>
    api.get(`/book/auth/google/url?bookingToken=${bookingToken}`),
  
  getMicrosoftGuestUrl: (bookingToken) =>
    api.get(`/book/auth/microsoft/url?bookingToken=${bookingToken}`),
  
  guestGoogleAuth: (code, bookingToken) =>
    api.post('/book/auth/google', { code, bookingToken }),
    
  handleMicrosoftCallback: (code) =>
    api.post('/auth/microsoft/callback', { code }),
    
  handleMicrosoftGuestCallback: (code, bookingToken) =>
    api.post('/book/auth/microsoft', { code, bookingToken }),
};
// ============================================
// PAYMENTS
// ============================================
export const payments = {
  getConfig: () => api.get('/payments/config'),
  getPricing: (token) => api.get(`/book/${token}/pricing`),
  createIntent: (data) => api.post('/payments/create-intent', data),
  confirmBooking: (data) => api.post('/payments/confirm-booking', data),
  getPaymentStatus: (paymentIntentId) =>
    api.get(`/payments/status/${paymentIntentId}`),
};

// ============================================
// AI - ✅ FIXED ENDPOINT
// ============================================
export const ai = {
  schedule: (message, history) =>
    api.post('/ai/schedule', {
      message,
      conversationHistory: history,
    }),
  confirm: (data) => api.post('/ai/schedule/confirm', data), // ✅ FIXED: Was /ai/confirm
  suggest: (preferences) => api.post('/ai/suggest', { preferences }),
};

// ============================================
// SINGLE-USE LINKS
// ============================================
export const singleUseLinks = {
  generate: (data) => api.post('/single-use-links', data),  // ✅ CHANGED: Now accepts data object
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

// Alias for compatibility
export const events = eventTypes;

// ============================================
// ANALYTICS
// ============================================
export const analytics = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getBookingStats: (startDate, endDate) =>
    api.get(`/analytics/bookings?start=${startDate}&end=${endDate}`),
  getTeamStats: (teamId) => api.get(`/analytics/teams/${teamId}`),
  getMemberStats: (memberId) => api.get(`/analytics/members/${memberId}`),
  exportData: (format = 'csv') =>
    api.get(`/analytics/export?format=${format}`),
};

// ============================================
// NOTIFICATIONS
// ============================================
export const notifications = {
  list: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

// ============================================
// TIMEZONE
// ============================================
export const timezone = {
  get: () => api.get('/user/timezone'),
  update: (tz) => api.put('/user/timezone', { timezone: tz }),
  list: () => api.get('/timezones'),
  detect: () => api.get('/timezones/detect'),
  convert: (fromTimezone, toTimezone, datetime) =>
    api.post('/timezones/convert', { fromTimezone, toTimezone, datetime }),
};

// ============================================
// USER
// ============================================
export const user = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  updatePassword: (data) => api.put('/profile/password', data),
  deleteAccount: () => api.delete('/profile'),
};

// ============================================
// BACKWARDS COMPATIBILITY - DIRECT EXPORTS
// ============================================

// These support: import { getGoogleUrl, handleGoogleCallback } from '../utils/api'
export const getGoogleUrl = oauth.getGoogleUrl;
export const handleGoogleCallback = oauth.handleCallback;

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

export const getCurrentUser = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    return null;
  }
};

export const getErrorMessage = (error) => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
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

export const batchRequest = async (requests) => {
  return Promise.all(requests.map((req) => api(req)));
};

// ============================================
// ✅ VITAL FIX: ATTACH MODULES TO DEFAULT EXPORT
// ============================================
// This ensures things like `api.auth.login()` and `api.oauth.getGoogleUrl()` work.
api.auth = auth;
api.oauth = oauth;
api.teams = teams;
api.bookings = bookings;
api.availability = availability;
api.reminders = reminders;
api.calendar = calendar;
api.payments = payments;
api.ai = ai;
api.singleUseLinks = singleUseLinks;
api.eventTypes = eventTypes;
api.events = events;
api.analytics = analytics;
api.notifications = notifications;
api.timezone = timezone;
api.user = user;

// Default export
export default api;