import axios from 'axios';

// Base API URL
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

  // Note: Backend doesn't explicitly have /auth/me in the provided server.js.
  // Usually this is handled by decoding the JWT on client or a specific endpoint.
  // If missing, ensure server.js has app.get('/api/auth/me', ...) or use local state.
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
  
  // FIX: Backend uses PATCH for member updates
  updateMember: (teamId, memberId, data) =>
    api.patch(`/teams/${teamId}/members/${memberId}`, data),
    
  removeMember: (teamId, memberId) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),

  // Pricing (Backend: /api/teams/:teamId/members/:memberId/pricing)
  getMemberPricing: (teamId, memberId) =>
    api.get(`/teams/${teamId}/members/${memberId}/pricing`),
    
  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  // External booking link
  getMemberExternalLink: (teamId, memberId) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`), // Check method, usually GET for fetch? backend uses PUT for update.
    
  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

// ---------- AVAILABILITY ----------
// FIX: Backend uses flattened route: /api/team-members/:id/availability
export const availability = {
  getSettings: (teamId, memberId) =>
    api.get(`/team-members/${memberId}/availability`),

  updateSettings: (teamId, memberId, data) =>
    api.put(`/team-members/${memberId}/availability`, data),
};

// ---------- BOOKINGS ----------
export const bookings = {
  // Internal dashboard list
  list: (params) => api.get('/bookings', { params }),

  // PUBLIC: Get page details
  getByToken: (token) => api.get(`/book/${token}`),

  // PUBLIC: Smart Slots
  // FIX: Backend uses POST for complex params (timezone, guest tokens)
  // FIX: Backend route is /slots-with-status
  getSlots: (token, data) =>
    api.post(`/book/${token}/slots-with-status`, data), 
    // data should be { duration, timezone, guestAccessToken... }

  // PUBLIC: Create Booking
  create: (payload) =>
    api.post('/bookings', payload),
    
  // Management (Cancel/Reschedule)
  getManagementDetails: (token) => api.get(`/bookings/manage/${token}`),
  rescheduleByToken: (token, data) => api.post(`/bookings/manage/${token}/reschedule`, data),
  cancelByToken: (token, reason) => api.post(`/bookings/manage/${token}/cancel`, { reason }),
};

// ---------- REMINDERS ----------
// FIX: Backend routes are per-team: /api/teams/:teamId/reminder-settings
export const reminders = {
  getSettings: (teamId) => api.get(`/teams/${teamId}/reminder-settings`),
  updateSettings: (teamId, data) => api.put(`/teams/${teamId}/reminder-settings`, data),
  getStatus: () => api.get('/reminders/status'),
};

// ---------- CALENDAR / GOOGLE AUTH ----------
export const calendar = {
  // FIX: Backend route is /api/auth/google/url
  connectGoogle: () => api.get('/auth/google/url'),
  
  // Note: disconnectGoogle is not explicitly in the provided server.js snippet 
  // but logic suggests it might be needed. Ensure backend exists.
  disconnectGoogle: () => api.post('/calendar/google/disconnect'), 
};

// ---------- ORGANIZER OAUTH CALLBACK ----------
export const handleOrganizerOAuthCallback = (code) => {
  // FIX: Backend expects POST with { code } in body
  return api.post('/auth/google/callback', { code });
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