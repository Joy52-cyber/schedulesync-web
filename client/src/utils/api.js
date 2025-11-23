import axios from 'axios';

// 1. Get the base URL from env or default
let rawBaseUrl = import.meta.env.VITE_API_URL || 'https://schedulesync-web-production.up.railway.app';
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');
const API_BASE = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

console.log('🌐 Final API Base URL:', API_BASE);

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- HELPERS ----------

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  verifyEmail: (token) => api.get('/auth/verify-email', { params: { token } }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
};

export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  get: (teamId) => api.get(`/teams/${teamId}`),
  update: (teamId, data) => api.put(`/teams/${teamId}`, data),
  
  // ✅ FIX: Added .delete() to fix "kt.delete is not a function"
  delete: (teamId) => api.delete(`/teams/${teamId}`),
  
  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  updateMember: (teamId, memberId, data) => api.patch(`/teams/${teamId}/members/${memberId}`, data),
  removeMember: (teamId, memberId) => api.delete(`/teams/${teamId}/members/${memberId}`),
  
  // ✅ FIX: Added .updateMemberStatus() to fix "kt.updateMemberStatus is not a function"
  updateMemberStatus: (teamId, memberId, is_active) => 
    api.patch(`/teams/${teamId}/members/${memberId}/status`, { is_active }),

  updateMemberPricing: (teamId, memberId, data) => api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),
  updateMemberExternalLink: (teamId, memberId, data) => api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

export const availability = {
  getSettings: (teamId, memberId) => api.get(`/team-members/${memberId}/availability`),
  updateSettings: (teamId, memberId, data) => api.put(`/team-members/${memberId}/availability`, data),
  
  // ✅ FIX: Added .get() alias to fix "zu.get is not a function"
  get: (teamId, memberId) => api.get(`/team-members/${memberId}/availability`),
};

export const bookings = {
  list: (params) => api.get('/bookings', { params }),
  
  // ✅ FIX: Added .getAll() alias to fix "Dl.getAll is not a function"
  getAll: (params) => api.get('/bookings', { params }),

  getByToken: (token) => api.get(`/book/${token}`),
  getSlots: (token, data) => api.post(`/book/${token}/slots-with-status`, data), 
  create: (payload) => api.post('/bookings', payload),
  
  getManagementDetails: (token) => api.get(`/bookings/manage/${token}`),
  rescheduleByToken: (token, data) => api.post(`/bookings/manage/${token}/reschedule`, data),
  cancelByToken: (token, reason) => api.post(`/bookings/manage/${token}/cancel`, { reason }),
};

export const reminders = {
  getSettings: (teamId) => api.get(`/teams/${teamId}/reminder-settings`),
  updateSettings: (teamId, data) => api.put(`/teams/${teamId}/reminder-settings`, data),
  getStatus: () => api.get('/reminders/status'),
};

export const calendar = {
  connectGoogle: () => api.get('/auth/google/url'),
  disconnectGoogle: () => api.post('/calendar/google/disconnect'), 
};

export const oauth = {
  handleCallback: (code) => api.post('/auth/google/callback', { code }),
  guestGoogleAuth: (code, bookingToken) => api.post('/book/auth/google', { code, bookingToken }),
};

export const payments = {
  getConfig: () => api.get('/payments/config'),
  getPricing: (token) => api.get(`/book/${token}/pricing`),
  createIntent: (data) => api.post('/payments/create-intent', data),
  confirmBooking: (data) => api.post('/payments/confirm-booking', data),
};

export const ai = {
  schedule: (message, history) => api.post('/ai/schedule', { message, conversationHistory: history }),
  confirm: (bookingData) => api.post('/ai/schedule/confirm', { bookingData })
};

export const timezone = {
  get: () => api.get('/user/timezone'),
  update: (data) => api.put('/user/timezone', data),
};

// ✅ CRITICAL: Attach all helpers to default export for backward compatibility
Object.assign(api, {
  auth,
  teams,
  availability,
  bookings,
  reminders,
  calendar,
  oauth,
  payments,
  ai,
  timezone
});

export default api;