// client/src/utils/api.js
import axios from 'axios';

// Base API URL (server already prefixes everything with /api)
const API_BASE =
  import.meta.env.VITE_API_URL ||
  'https://schedulesync-web-production.up.railway.app/api';

console.log('🌐 API BASE:', API_BASE);

export const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT token (if present) on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- AUTH ----------
export const auth = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  register: (data) =>
    api.post('/auth/register', data),

  me: () =>
    api.get('/auth/me'),

  verifyEmail: (token) =>
    api.get('/auth/verify-email', { params: { token } }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, password) =>
    api.post('/auth/reset-password', { token, password }),
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
    api.put(`/teams/${teamId}/members/${memberId}`, data),
  removeMember: (teamId, memberId) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),

  // Availability
  getMemberAvailability: (teamId, memberId) =>
    api.get(`/teams/${teamId}/members/${memberId}/availability`),
  updateMemberAvailability: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/availability`, data),

  // Pricing
  getMemberPricing: (teamId, memberId) =>
    api.get(`/teams/${teamId}/members/${memberId}/pricing`),
  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  // External booking link
  getMemberExternalLink: (teamId, memberId) =>
    api.get(`/teams/${teamId}/members/${memberId}/external-link`),
  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

// ---------- AVAILABILITY (for MemberAvailability.jsx) ----------
export const availability = {
  // Wrapper around the team/member availability endpoints
  getSettings: (teamId, memberId) =>
    teams.getMemberAvailability(teamId, memberId),

  updateSettings: (teamId, memberId, data) =>
    teams.updateMemberAvailability(teamId, memberId, data),

  // Optional preview endpoint if implemented on the backend
  getPreviewSlots: (teamId, memberId, params = {}) =>
    api.get(
      `/teams/${teamId}/members/${memberId}/availability/preview`,
      { params }
    ),
};

// ---------- BOOKINGS ----------
export const bookings = {
  // Used by internal dashboard / bookings page
  list: (params) => api.get('/bookings', { params }),

  // PUBLIC: used by BookingPage.loadBookingInfo
  // Backend route is /api/book/:token
  getByToken: (token) => api.get(`/book/${token}`),

  // PUBLIC: SmartSlotPicker → /api/book/:token/slots
  getSlots: (token, params) =>
    api.get(`/book/${token}/slots`, { params }),

  // PUBLIC: BookingPage free bookings (paid bookings use fetch to /api/payments/...)
  create: (payload) =>
    api.post('/bookings', payload),
};

// ---------- SETTINGS / REMINDERS ----------
export const reminders = {
  getSettings: () => api.get('/reminders/settings'),
  updateSettings: (data) => api.put('/reminders/settings', data),
  getStatus: () => api.get('/reminders/status'),
};

// ---------- CALENDAR SETTINGS ----------
export const calendar = {
  getSettings: () => api.get('/calendar/settings'),
  updateSettings: (data) => api.put('/calendar/settings', data),
  connectGoogle: () => api.get('/calendar/google/url'),
  disconnectGoogle: () => api.post('/calendar/google/disconnect'),
};

// ---------- GOOGLE OAUTH (Organizer Calendar Sync) ----------
export const handleOrganizerOAuthCallback = (code) => {
  return api.get('/auth/google/callback', {
    params: { code },
  });
};


export default api;
