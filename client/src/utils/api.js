// client/src/utils/api.js
import axios from "axios";

// ------------------------------------------------------
// API BASE URL RESOLUTION
// ------------------------------------------------------
const getApiUrl = () => {
  const vite = import.meta.env.VITE_API_URL;

  if (vite) {
    // Strip trailing slashes and optional `/api`
    return vite.replace(/\/+$/, "").replace(/\/api$/, "");
  }

  if (window.location.hostname === "localhost") {
    return "http://localhost:3000";
  }

  return window.location.origin;
};

const API_BASE = getApiUrl();
export const API_URL = `${API_BASE}/api`;

console.log("🔌 API Configuration:", {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE,
  API_URL,
});

// ------------------------------------------------------
// AXIOS INSTANCE
// ------------------------------------------------------
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ------------------------------------------------------
// AUTH
// ------------------------------------------------------
export const auth = {
  googleLogin: (code) =>
    apiClient.post("/auth/google", {
      code,
      redirectUri: `${window.location.origin}/login`,
    }),

  register: (data) => apiClient.post("/auth/register", data),
  login: (data) => apiClient.post("/auth/login", data),

  forgotPassword: (email) =>
    apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (token, password) =>
    apiClient.post("/auth/reset-password", { token, newPassword: password }),

  verifyEmail: (token) => apiClient.get(`/auth/verify-email?token=${token}`),

  resendVerification: (email) =>
    apiClient.post("/auth/resend-verification", { email }),

  getCurrentUser: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout"),
};

// Used by OAuthCallback.jsx (organizer connection)
export const handleOrganizerOAuthCallback = async (code) => {
  const res = await apiClient.post("/auth/google/callback", { code });
  return res.data;
};

// ------------------------------------------------------
// TEAMS
// ------------------------------------------------------
export const teams = {
  // Base CRUD
  getAll: () => apiClient.get("/teams"),
  getById: (id) => apiClient.get(`/teams/${id}`),
  create: (data) => apiClient.post("/teams", data),
  update: (id, data) => apiClient.put(`/teams/${id}`, data),

  // Both `delete` and `remove` so existing code works
  delete: (id) => apiClient.delete(`/teams/${id}`),
  remove: (id) => apiClient.delete(`/teams/${id}`),

  // Members
  getMembers: (teamId) => apiClient.get(`/teams/${teamId}/members`),
  removeMember: (teamId, memberId) =>
    apiClient.delete(`/teams/${teamId}/members/${memberId}`),

  updateMemberStatus: (teamId, memberId, isActive) =>
    apiClient.patch(`/teams/${teamId}/members/${memberId}/status`, {
      is_active: isActive,
    }),

  updateMemberExternalLink: (teamId, memberId, data) =>
    apiClient.put(
      `/teams/${teamId}/members/${memberId}/external-link`,
      data
    ),

  updateMemberPricing: (teamId, memberId, data) =>
    apiClient.put(`/teams/${teamId}/members/${memberId}/pricing`, data),
};

// ------------------------------------------------------
// BOOKINGS
// (used by BookingPage, Bookings list, etc.)
// ------------------------------------------------------

export const bookings = {
  getAll: () => apiClient.get("/bookings"),
  list: (params) => apiClient.get("/bookings", { params }),
  getById: (id) => apiClient.get(`/bookings/${id}`),
  getByToken: (token) => apiClient.get(`/bookings/token/${token}`),
  cancel: (id, data) => apiClient.post(`/bookings/${id}/cancel`, data),

  // 🔹 NEW: Smart slot picker endpoint
  getSlots: (bookingToken, options = {}) =>
    apiClient.post("/book/slots", {
      bookingToken,
      ...options, // guestAccessToken, guestRefreshToken, duration, timezone
    }),
};


// ------------------------------------------------------
// AVAILABILITY
// ------------------------------------------------------
export const availability = {
  get: (memberId) =>
    apiClient.get(`/team-members/${memberId}/availability`),
  update: (memberId, data) =>
    apiClient.put(`/team-members/${memberId}/availability`, data),

  // Aliases if other code still uses old names
  getMemberAvailability: (id) =>
    apiClient.get(`/team-members/${id}/availability`),
  updateMemberAvailability: (id, data) =>
    apiClient.put(`/team-members/${id}/availability`, data),
};

// ------------------------------------------------------
// BOOKING LINKS (MyBookingLink, etc.)
// ------------------------------------------------------
export const bookingLinks = {
  getMyLinks: () => apiClient.get("/booking-links"),
  create: (data) => apiClient.post("/booking-links", data),
  update: (id, data) => apiClient.put(`/booking-links/${id}`, data),
  remove: (id) => apiClient.delete(`/booking-links/${id}`),
};

// ------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------
export const dashboard = {
  getOverview: () => apiClient.get("/dashboard/overview"),
  getStats: () => apiClient.get("/dashboard/stats"),
};

// ------------------------------------------------------
// AI
// ------------------------------------------------------
export const ai = {
  schedulerChat: (payload) =>
    apiClient.post("/ai/scheduler/chat", payload),
};

export default apiClient;
