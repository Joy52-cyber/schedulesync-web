// client/src/utils/api.js
import axios from "axios";

// --------------------------------------------------
// Environment-safe helpers
// --------------------------------------------------
const isBrowser = typeof window !== "undefined";

// Safely read from localStorage
const safeGetItem = (key) => {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeRemoveItem = (key) => {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

// --------------------------------------------------
// Resolve correct API base URL
// --------------------------------------------------
const getApiUrl = () => {
  const viteUrl = import.meta.env.VITE_API_URL;

  if (viteUrl) {
    // strip trailing slashes and an optional /api suffix
    return viteUrl.replace(/\/+$/, "").replace(/\/api$/, "");
  }

  if (isBrowser && window.location.hostname === "localhost") {
    return "http://localhost:3000";
  }

  return isBrowser ? window.location.origin : "http://localhost:3000";
};

const API_BASE = getApiUrl();
export const API_URL = `${API_BASE}/api`;

console.log("🔌 API Configuration:", {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE,
  API_URL,
});

// --------------------------------------------------
// Axios client
// --------------------------------------------------
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach Authorization header if token exists
apiClient.interceptors.request.use((config) => {
  const token = safeGetItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handler
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && isBrowser) {
      console.error("❌ 401 Unauthorized – clearing session");
      safeRemoveItem("token");
      safeRemoveItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// --------------------------------------------------
// AUTH
// --------------------------------------------------
export const auth = {
  // Google OAuth login – supports string code or full payload
  googleLogin: (codeOrPayload) => {
    let payload = codeOrPayload;

    if (typeof codeOrPayload === "string") {
      payload = {
        code: codeOrPayload,
        redirectUri: isBrowser
          ? `${window.location.origin}/login`
          : undefined,
      };
    }

    return apiClient.post("/auth/google", payload);
  },

  // Email/password auth
  register: (data) => apiClient.post("/auth/register", data),
  login: (data) => apiClient.post("/auth/login", data),

  // Password reset
  forgotPassword: (email) =>
    apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (token, newPassword) =>
    apiClient.post("/auth/reset-password", { token, newPassword }),

  // Email verification
  verifyEmail: (token) =>
    apiClient.get(`/auth/verify-email?token=${token}`),

  resendVerification: (email) =>
    apiClient.post("/auth/resend-verification", { email }),

  // Session
  getCurrentUser: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout"),

  // Test user helper (if backend supports it)
  createTestUser: () => apiClient.get("/auth/create-test-user"),
};

// old imports still work: import { googleLogin } from '../utils/api'
export const googleLogin = auth.googleLogin;

// Organizer OAuth callback (used by OAuthCallback.jsx)
export const handleOrganizerOAuthCallback = async (code) => {
  const payload = {
    code,
    redirectUri: isBrowser
      ? `${window.location.origin}/oauth/callback`
      : undefined,
  };
  const res = await apiClient.post("/auth/google", payload);
  return res.data; // expecting { token, user, ... }
};

// Organizer OAuth URL (for “Connect calendar” buttons etc.)
export const getOrganizerOAuthUrl = async () => {
  const res = await apiClient.get("/auth/google/url");
  return res.data;
};

// --------------------------------------------------
// TEAMS
// --------------------------------------------------
export const teams = {
  getAll: () => apiClient.get("/teams"),
  getById: (id) => apiClient.get(`/teams/${id}`),
  create: (data) => apiClient.post("/teams", data),
  update: (id, data) => apiClient.put(`/teams/${id}`, data),
  remove: (id) => apiClient.delete(`/teams/${id}`),

  // Used by /teams/:id/members page
  getMembers: (teamId) =>
    apiClient.get(`/teams/${teamId}/members`),

  inviteMember: (teamId, data) =>
    apiClient.post(`/teams/${teamId}/invite`, data),
};

// --------------------------------------------------
// BOOKINGS
// --------------------------------------------------
export const bookings = {
  list: (params) => apiClient.get("/bookings", { params }),
  getById: (id) => apiClient.get(`/bookings/${id}`),
  cancel: (id, data) => apiClient.post(`/bookings/${id}/cancel`, data),
  updateStatus: (id, data) =>
    apiClient.post(`/bookings/${id}/status`, data),

  // Public booking page /book/:token
  getByToken: (token) =>
    apiClient.get(`/bookings/public/${token}`),
};

// --------------------------------------------------
// AVAILABILITY
// --------------------------------------------------
export const availability = {
  getMemberAvailability: (memberId) =>
    apiClient.get(`/team-members/${memberId}/availability`),

  updateMemberAvailability: (memberId, data) =>
    apiClient.put(`/team-members/${memberId}/availability`, data),
};

// --------------------------------------------------
// BOOKING LINKS
// --------------------------------------------------
export const bookingLinks = {
  getMyLinks: () => apiClient.get("/booking-links"),
  create: (data) => apiClient.post("/booking-links", data),
  update: (id, data) =>
    apiClient.put(`/booking-links/${id}`, data),
  remove: (id) =>
    apiClient.delete(`/booking-links/${id}`),
};

// --------------------------------------------------
// DASHBOARD / ANALYTICS
// --------------------------------------------------
export const dashboard = {
  getOverview: () => apiClient.get("/dashboard/overview"),
  getRevenue: () => apiClient.get("/dashboard/revenue"),
  getActivity: () => apiClient.get("/dashboard/activity"),
};

// --------------------------------------------------
// AI
// --------------------------------------------------
export const ai = {
  schedulerChat: (payload) =>
    apiClient.post("/ai/scheduler/chat", payload),
  suggestSlots: (payload) =>
    apiClient.post("/ai/suggest-slots", payload),
};

export default apiClient;
