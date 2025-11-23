import axios from 'axios';

// 1. Get the base URL from env or default
let rawBaseUrl = import.meta.env.VITE_API_URL || 'https://schedulesync-web-production.up.railway.app';

// 2. Ensure the URL is "clean" (remove trailing slash)
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');

// 3. Force the URL to end in "/api" if it doesn't already
// This fixes the 404 if your env var is just the domain name
const API_BASE = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

console.log('🌐 Final API Base URL:', API_BASE);

export const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT token (if present) on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Debug log to verify the exact URL being requested
  const fullUrl = `${config.baseURL}${config.url}`;
  console.log(`🚀 Requesting: ${config.method.toUpperCase()} ${fullUrl}`);
  
  return config;
});

// ---------- AUTH ----------
export const auth = {
  // This results in: .../api/auth/login
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  register: (data) =>
    api.post('/auth/register', data),

  me: () => api.get('/auth/me'),

  verifyEmail: (token) =>
    api.get('/auth/verify-email', { params: { token } }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

// ---------- TEAMS ----------
export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  get: (teamId) => api.get(`/teams/${teamId}`),
  update: (teamId, data) => api.put(`/teams/${teamId}`, data),

  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  
  updateMember: (teamId, memberId, data) =>
    api.patch(`/teams/${teamId}/members/${memberId}`, data),
    
  removeMember: (teamId, memberId) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),

  // Pricing
  getMemberPricing: (teamId, memberId) =>
    api.get(`/teams/${teamId}/members/${memberId}/pricing`),
    
  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  // External booking link
  getMemberExternalLink: (teamId, memberId) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`), 
    
  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

// ---------- AVAILABILITY ----------
export const availability = {
  getSettings: (teamId, memberId) =>
    api.get(`/team-members/${memberId}/availability`),

  updateSettings: (teamId, memberId, data) =>
    api.put(`/team-members/${memberId}/availability`, data),
};

// ---------- BOOKINGS ----------
export const bookings = {
  list: (params) => api.get('/bookings', { params }),

  getByToken: (token) => api.get(`/book/${token}`),

  getSlots: (token, data) =>
    api.post(`/book/${token}/slots-with-status`, data), 

  create: (payload) =>
    api.post('/bookings', payload),
    
  getManagementDetails: (token) => api.get(`/bookings/manage/${token}`),
  rescheduleByToken: (token, data) => api.post(`/bookings/manage/${token}/reschedule`, data),
  cancelByToken: (token, reason) => api.post(`/bookings/manage/${token}/cancel`, { reason }),
};

// ---------- REMINDERS ----------
export const reminders = {
  getSettings: (teamId) => api.get(`/teams/${teamId}/reminder-settings`),
  updateSettings: (teamId, data) => api.put(`/teams/${teamId}/reminder-settings`, data),
  getStatus: () => api.get('/reminders/status'),
};

// ---------- CALENDAR / GOOGLE AUTH ----------
export const calendar = {
  connectGoogle: () => api.get('/auth/google/url'),
  
  disconnectGoogle: () => api.post('/calendar/google/disconnect'), 
};

// ---------- ORGANIZER OAUTH ----------
export const oauth = {
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

// ---------- AI ASSISTANT ----------
export const ai = {
  schedule: (message, history) => api.post('/ai/schedule', { message, conversationHistory: history }),
  confirm: (bookingData) => api.post('/ai/schedule/confirm', { bookingData })
};

export default api;