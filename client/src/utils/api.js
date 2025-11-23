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

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),

  resendVerification: (email) =>
    api.post('/auth/resend-verification', { email }),
};

// ---------- TEAMS ----------
export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  get: (teamId) => api.get(`/teams/${teamId}`),
  update: (teamId, data) => api.put(`/teams/${teamId}`, data),
  delete: (teamId) => api.delete(`/teams/${teamId}`),

  // Members
  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  
  // ✅ FIX: Changed PUT to PATCH to match backend
  updateMember: (teamId, memberId, data) =>
    api.patch(`/teams/${teamId}/members/${memberId}`, data),
  
  // ✅ NEW: Added member status toggle
  updateMemberStatus: (teamId, memberId, is_active) =>
    api.patch(`/teams/${teamId}/members/${memberId}/status`, { is_active }),
  
  removeMember: (teamId, memberId) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),

  // Pricing
  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  // External booking link
  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),

  // Reminder settings
  getReminderSettings: (teamId) =>
    api.get(`/teams/${teamId}/reminder-settings`),
  updateReminderSettings: (teamId, data) =>
    api.put(`/teams/${teamId}/reminder-settings`, data),
};

// ---------- AVAILABILITY ----------
// ✅ FIX: Updated to match backend /team-members/:id/availability
export const availability = {
  getSettings: (memberId) =>
    api.get(`/team-members/${memberId}/availability`),

  updateSettings: (memberId, data) =>
    api.put(`/team-members/${memberId}/availability`, data),
};

// ---------- BOOKINGS ----------
export const bookings = {
  // Dashboard bookings list
  list: (params) => api.get('/bookings', { params }),

  // PUBLIC: Get booking page info
  getByToken: (token) => api.get(`/book/${token}`),

  // ✅ FIX: Changed to POST /book/:token/slots-with-status
  getSlots: (token, data) =>
    api.post(`/book/${token}/slots-with-status`, data),

  // PUBLIC: Create booking
  create: (payload) =>
    api.post('/bookings', payload),

  // Cancel booking (authenticated)
  cancel: (bookingId, reason) =>
    api.post(`/bookings/${bookingId}/cancel`, { reason }),

  // Reschedule booking (authenticated)
  reschedule: (bookingId, newStartTime, newEndTime) =>
    api.post(`/bookings/${bookingId}/reschedule`, { newStartTime, newEndTime }),

  // ✅ NEW: Guest booking management (no auth)
  getByManageToken: (token) =>
    api.get(`/bookings/manage/${token}`),

  rescheduleByToken: (token, newStartTime, newEndTime) =>
    api.post(`/bookings/manage/${token}/reschedule`, { newStartTime, newEndTime }),

  cancelByToken: (token, reason) =>
    api.post(`/bookings/manage/${token}/cancel`, { reason }),
};

// ---------- PAYMENTS ----------
export const payments = {
  getConfig: () =>
    api.get('/payments/config'),

  getPricing: (token) =>
    api.get(`/book/${token}/pricing`),

  createIntent: (bookingToken, attendeeName, attendeeEmail) =>
    api.post('/payments/create-intent', { bookingToken, attendeeName, attendeeEmail }),

  confirmBooking: (paymentIntentId, bookingToken, slot, attendeeName, attendeeEmail, notes) =>
    api.post('/payments/confirm-booking', { 
      paymentIntentId, bookingToken, slot, attendeeName, attendeeEmail, notes 
    }),

  refund: (bookingId, reason) =>
    api.post('/payments/refund', { bookingId, reason }),
};

// ---------- REMINDERS ----------
export const reminders = {
  getStatus: () => api.get('/reminders/status'),
  sendManual: () => api.post('/admin/send-reminders'),
};

// ---------- DASHBOARD ----------
export const dashboard = {
  getStats: () => api.get('/dashboard/stats'),
};

// ---------- MY BOOKING LINK ----------
export const myBookingLink = {
  get: () => api.get('/my-booking-link'),
};

// ---------- AI ASSISTANT ----------
export const ai = {
  schedule: (message, conversationHistory = []) =>
    api.post('/ai/schedule', { message, conversationHistory }),

  confirmBooking: (bookingData) =>
    api.post('/ai/schedule/confirm', { bookingData }),
};

// ---------- OAUTH ----------
export const oauth = {
  // Organizer OAuth (dashboard login)
  getGoogleUrl: () =>
    api.get('/auth/google/url'),

  handleCallback: (code) =>
    api.post('/auth/google/callback', { code }),

  // Guest OAuth (booking page calendar sync)
  guestGoogleAuth: (code, bookingToken) =>
    api.post('/book/auth/google', { code, bookingToken }),
};

// ---------- TIMEZONE ----------
export const timezone = {
  get: () =>
    api.get('/user/timezone'),

  update: (timezone) =>
    api.put('/user/timezone', { timezone }),

  getMemberTimezone: (memberId) =>
    api.get(`/team-members/${memberId}/timezone`),

  updateMemberTimezone: (memberId, timezone) =>
    api.put(`/team-members/${memberId}/timezone`, { timezone }),
};

export default api;