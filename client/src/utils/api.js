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

// Export base URL without /api for static assets (logos, uploads)
export const STATIC_BASE_URL = rawBaseUrl.replace(/\/api$/, '');

console.log('🔗 Final API Base URL:', API_BASE);
console.log('🔗 Static Base URL:', STATIC_BASE_URL);

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

// Response interceptor with auth handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle auth failures
    if ((error.response?.status === 401 || error.response?.status === 403) && !error.config?.url?.includes('/subscription') && !error.config?.url?.includes('/limits') && !error.config?.url?.includes('/usage') && !error.config?.url?.includes('/teams')) {
    console.log('?? Auth failed, clearing token and redirecting...');
      localStorage.removeItem('token');
      
      // Only redirect if we're not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?error=session_expired';
      }
    }
    return Promise.reject(error);
  }
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
  updateProfile: (data) => api.put('/user/profile', data),
  getGoogleUrl: () => api.get('/auth/google/url'),
};

// ============================================
// OAUTH - COMPLETE (Merged from duplicates)
// ============================================
export const oauth = {
  // ORGANIZER LOGIN OAUTH METHODS
  getGoogleUrl: () => api.get('/auth/google/url'),
  getMicrosoftUrl: () => api.get('/auth/microsoft/url'),
  getCalendlyUrl: () => api.get('/auth/calendly/url'),
  
  handleGoogleCallback: (code) => api.post('/auth/google/callback', { code }),
  handleMicrosoftCallback: (code) => api.post('/auth/microsoft/callback', { code }),
  handleCalendlyCallback: (code) => api.post('/auth/calendly/callback', { code }),

  // GUEST OAUTH METHODS (for booking pages)  
  getGoogleGuestUrl: (bookingToken) =>
    api.get('/book/auth/google/url', { params: { bookingToken } }),
  
  getMicrosoftGuestUrl: (bookingToken) =>
    api.get('/book/auth/microsoft/url', { params: { bookingToken } }),
  
  guestGoogleAuth: (code, bookingToken) =>
    api.post('/book/auth/google', { code, bookingToken }),
    
  guestMicrosoftAuth: (code, bookingToken) =>
    api.post('/book/auth/microsoft', { code, bookingToken }),
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

  updateMember: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}`, data),

  updateMemberStatus: (teamId, memberId, is_active) =>
    api.patch(`/teams/${teamId}/members/${memberId}/status`, { is_active }),

  updateMemberPricing: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/pricing`, data),

  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),

  // Team availability and assignment features
  getAvailability: (teamId, data) => api.post(`/teams/${teamId}/availability`, data),
  getAssignmentStats: (teamId) => api.get(`/teams/${teamId}/assignment-stats`),

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
  getSettings: () => api.get('/reminders/settings'),
  updateSettings: (data) => api.put('/reminders/settings', data),
  getHistory: (params) => api.get('/reminders/history', { params }),
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
// AI
// ============================================
export const ai = {
  schedule: (message, history) =>
    api.post('/ai/schedule', {
      message,
      conversationHistory: history,
    }),
  confirm: (data) => api.post('/ai/schedule/confirm', data),
  suggest: (preferences) => api.post('/ai/suggest', { preferences }),
};

// ============================================
// AI SCHEDULER (Alias for AISchedulerChat component)
// ============================================
export const aiScheduler = {
  sendMessage: async (message, history = []) => {
    return api.post('/ai/schedule', {
      message,
      conversationHistory: history
    });
  },

  confirmBooking: async (bookingData) => {
    return api.post('/ai/schedule/confirm', bookingData);
  },

  suggestTimes: async (duration = 30, attendeeEmail = null, notes = null) => {
    return api.post('/ai/suggest', {
      duration,
      attendeeEmail,
      notes
    });
  }
};

// ============================================
// SINGLE-USE LINKS
// ============================================
export const singleUseLinks = {
  generate: (data) => api.post('/single-use-links', data),
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
// EMAIL TEMPLATES
// ============================================
export const emailTemplates = {
  // Get all templates for user
  getAll: () => api.get('/email-templates'),
  
  // Get single template
  get: (id) => api.get(`/email-templates/${id}`),
  
  // Create new template
  create: (data) => api.post('/email-templates', data),
  
  // Update template
  update: (id, data) => api.put(`/email-templates/${id}`, data),
  
  // Delete template
  delete: (id) => api.delete(`/email-templates/${id}`),
  
  // Toggle favorite
  toggleFavorite: (id) => api.patch(`/email-templates/${id}/favorite`),
  
  // ChatGPT Integration endpoints
  listForAI: (type) => api.get('/chatgpt/email-templates', { params: { type } }),
  findTemplate: (query, type) => api.get('/chatgpt/find-template', { params: { query, type } }),
  sendWithTemplate: (data) => api.post('/chatgpt/send-email', data),
};

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

export const chatgptIntegration = {
  getToken: () => api.get('/user/jwt-token'),
  refreshToken: () => api.post('/user/refresh-chatgpt-token'),
  testConnection: () => api.get('/user/test-chatgpt-connection'),
  getSetupGuide: () => api.get('/user/chatgpt-setup-guide'),
  getSchema: () => api.get('/user/chatgpt-openapi-schema'),
};

// ============================================
// USER
// ============================================

// ? FIND your user object and ADD the limits method:
export const user = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  updatePassword: (data) => api.put('/profile/password', data),
  deleteAccount: () => api.delete('/profile'),
  usage: () => api.get('/user/usage'),
  limits: () => api.get('/user/limits'), // ? ADD THIS LINE
};

// ============================================
// ACTION ITEMS
// ============================================
export const actionItems = {
  getMyTasks: () => api.get('/action-items/my-tasks'),
  getForBooking: (bookingId) => api.get(`/bookings/${bookingId}/action-items`),
  create: (bookingId, data) => api.post(`/bookings/${bookingId}/action-items`, data),
  update: (itemId, data) => api.put(`/action-items/${itemId}`, data),
  complete: (itemId) => api.put(`/action-items/${itemId}/complete`),
  uncomplete: (itemId) => api.put(`/action-items/${itemId}/uncomplete`),
  delete: (itemId) => api.delete(`/action-items/${itemId}`),
};

// ============================================
// ATTENDEES & RELATIONSHIPS
// ============================================
export const attendees = {
  getAll: (params) => api.get('/attendees', { params }),
  getByEmail: (email) => api.get(`/attendees/${encodeURIComponent(email)}`),
  updateNotes: (email, notes) => api.put(`/attendees/${encodeURIComponent(email)}/notes`, { notes }),
  updateProfile: (email, data) => api.put(`/attendees/${encodeURIComponent(email)}/profile`, data),
  getStats: () => api.get('/attendees-stats/summary'),
};

// ============================================
// MEETING CONTEXT
// ============================================
export const meetingContext = {
  get: (bookingId) => api.get(`/bookings/${bookingId}/context`),
  generateAgenda: (bookingId) => api.post(`/bookings/${bookingId}/context/agenda`),
  updateNotes: (bookingId, notes) => api.put(`/bookings/${bookingId}/context/notes`, { notes }),
};

// ============================================
// GROUP AVAILABILITY
// ============================================
export const groupAvailability = {
  find: (data) => api.post('/group-availability', data),
  checkSlot: (data) => api.post('/group-availability/check-slot', data),
};

// ============================================
// SMART FEATURES
// ============================================
export const smart = {
  getSuggestions: (data) => api.post('/smart-suggestions', data),
  getCalendarAnalytics: (timeRange) => api.get('/calendar-analytics', { params: { timeRange } }),
};

// ============================================
// MEETING TEMPLATES
// ============================================
export const templates = {
  getAll: () => api.get('/meeting-templates'),
  create: (data) => api.post('/meeting-templates', data),
  get: (id) => api.get(`/meeting-templates/${id}`),
  update: (id, data) => api.put(`/meeting-templates/${id}`, data),
  delete: (id) => api.delete(`/meeting-templates/${id}`),
  createBooking: (templateId, data) => api.post(`/bookings/from-template/${templateId}`, data),
};

// ============================================
// INTEGRATIONS
// ============================================
export const integrations = {
  slack: {
    connect: () => api.get('/integrations/slack/connect'),
    disconnect: () => api.delete('/integrations/slack'),
    getStatus: () => api.get('/integrations/slack/status'),
    updateSettings: (data) => api.put('/integrations/slack/settings', data),
  },
  webhooks: {
    getAll: () => api.get('/integrations/webhooks'),
    create: (data) => api.post('/integrations/webhooks', data),
    update: (id, data) => api.put(`/integrations/webhooks/${id}`, data),
    delete: (id) => api.delete(`/integrations/webhooks/${id}`),
    test: (id) => api.post(`/integrations/webhooks/${id}/test`),
    getDeliveries: (id) => api.get(`/integrations/webhooks/${id}/deliveries`),
  },
  crm: {
    connect: (provider) => api.get(`/integrations/${provider}/connect`),
    disconnect: (provider) => api.delete(`/integrations/${provider}`),
    sync: (provider) => api.post(`/integrations/${provider}/sync`),
    getStatus: (provider) => api.get(`/integrations/${provider}/status`),
  },
};
// ============================================
// BACKWARDS COMPATIBILITY - DIRECT EXPORTS
// ============================================
export const getGoogleUrl = oauth.getGoogleUrl;
export const handleGoogleCallback = oauth.handleGoogleCallback;

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
// BILLING & SUBSCRIPTIONS
// ============================================
export const billing = {
  // Subscription management
  getCurrent: () => api.get('/subscriptions/current'),
  create: (data) => api.post('/subscriptions/create', data),
  cancel: () => api.post('/subscriptions/cancel'),
  reactivate: () => api.post('/subscriptions/reactivate'),
  
  // Billing endpoints
  getSubscription: () => api.get('/billing/subscription'),
  createCheckout: (data) => api.post('/billing/create-checkout', data),
  getInvoices: () => api.get('/billing/invoices'),
  downloadInvoice: (id) => api.get(`/billing/invoices/${id}/download`, { responseType: 'blob' }),
  
  // Billing portal
  getBillingPortal: () => api.post('/subscriptions/billing-portal'),
};

// ============================================
// ATTACH ALL MODULES TO API INSTANCE
// ============================================
api.auth = auth;
api.oauth = oauth;
api.teams = teams;
api.bookings = bookings;
api.availability = availability;
api.reminders = reminders;
api.calendar = calendar;
api.payments = payments;
api.ai = ai;
api.aiScheduler = aiScheduler;
api.singleUseLinks = singleUseLinks;
api.eventTypes = eventTypes;
api.events = events;
api.emailTemplates = emailTemplates;
api.analytics = analytics;
api.notifications = notifications;
api.timezone = timezone;
api.user = user;
api.chatgptIntegration = chatgptIntegration;
api.billing = billing;
api.actionItems = actionItems;
api.attendees = attendees;
api.meetingContext = meetingContext;
api.groupAvailability = groupAvailability;
api.smart = smart;
api.templates = templates;
api.integrations = integrations;


// Default export
export default api;
