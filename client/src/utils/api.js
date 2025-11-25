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

// ---------- AUTH ----------
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
};

// ---------- TEAMS & MEMBERS ----------
export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  get: (teamId) => api.get(`/teams/${teamId}`),
  update: (teamId, data) => api.put(`/teams/${teamId}`, data),
  delete: (teamId) => api.delete(`/teams/${teamId}`),

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
};

// ---------- AVAILABILITY ----------
export const availability = {
  getSettings: (_, memberId) =>
    api.get(`/team-members/${memberId}/availability`),

  updateSettings: (_, memberId, data) =>
    api.put(`/team-members/${memberId}/availability`, data),
};

// ---------- BOOKINGS ----------
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

// ---------- REMINDERS ----------
export const reminders = {
  getSettings: (teamId) => api.get(`/teams/${teamId}/reminder-settings`),
  updateSettings: (teamId, data) =>
    api.put(`/teams/${teamId}/reminder-settings`, data),
  getStatus: () => api.get('/reminders/status'),
};

// ---------- CALENDAR / OAUTH ----------
export const calendar = {
  connectGoogle: () => api.get('/auth/google/url'),
  disconnectGoogle: () => api.post('/calendar/google/disconnect'),
};

export const oauth = {
  getGoogleUrl: () => api.get('/auth/google/url'),
  handleCallback: (code) => api.post('/auth/google/callback', { code }),
  guestGoogleAuth: (code, bookingToken) =>
    api.post('/book/auth/google', { code, bookingToken }),
};

// ---------- PAYMENTS ----------
export const payments = {
  getConfig: () => api.get('/payments/config'),
  getPricing: (token) => api.get(`/book/${token}/pricing`),
  createIntent: (data) => api.post('/payments/create-intent', data),
  confirmBooking: (data) => api.post('/payments/confirm-booking', data),
};

// ---------- AI ----------
export const ai = {
  schedule: (message, history) =>
    api.post('/ai/schedule', {
      message,
      conversationHistory: history,
    }),
  confirm:
