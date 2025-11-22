// client/src/utils/api.js
import axios from "axios";

/**
 * Resolve the base API URL.
 * Priority:
 *  1. VITE_API_URL (from env)
 *  2. http://localhost:3000 (for local dev)
 *  3. window.location.origin (for production)
 */
const getApiUrl = () => {
  const vite = import.meta.env.VITE_API_URL;

  if (vite) {
    // Strip trailing slashes and a trailing /api if present
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

// ----------------------------------------------------------------------
// AXIOS INSTANCE
// ----------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handler
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

// ----------------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------------
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

// Used by /oauth/callback page
export const handleOrganizerOAuthCallback = async (code) => {
  const res = await apiClient.post("/auth/google/callback", { code });
  return res.data;
};

// ----------------------------------------------------------------------
// TEAMS
// ----------------------------------------------------------------------
export const teams = {
  getAll: () => apiClient.get("/teams"),
  getById: (id) => apiClient.get(`/teams/${id}`),
  create: (data) => apiClient.post("/teams", data),
  update: (id, data) => apiClient.put(`/teams/${id}`, data),
  remove: (id) => apiClient.delete(`/teams/${id}`),
};

// ----------------------------------------------------------------------
// BOOKINGS
// ----------------------------------------------------------------------
export const bookings = {
  getAll: () => apiClient.get("/bookings"),
  list: (params) => apiClient.get("/bookings", { params }),
  getById: (id) => apiClient.get(`/bookings/${id}`),
  cancel: (id, data) => apiClient.post(`/bookings/${id}/cancel`, data),
};

// ----------------------------------------------------------------------
// AVAILABILITY
// ----------------------------------------------------------------------
export const availability = {
  getMemberAvailability: (id) =>
    apiClient.get(`/team-members/${id}/availability`),

  updateMemberAvailability: (id, data) =>
    apiClient.put(`/team-members/${id}/availability`, data),
};

// ----------------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------------
export const dashboard = {
  getStats: () => apiClient.get("/dashboard/stats"),
};

export default apiClient;
