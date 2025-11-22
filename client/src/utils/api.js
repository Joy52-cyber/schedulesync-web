// client/src/utils/api.js
import axios from "axios";

/* -------------------------------------------------------
   API BASE URL RESOLUTION
------------------------------------------------------- */
const getApiUrl = () => {
  const vite = import.meta.env.VITE_API_URL;

  if (vite) {
    // Remove trailing slashes and avoid double /api/api
    return vite.replace(/\/+$/, "").replace(/\/api$/, "");
  }

  // Local development fallback
  if (window.location.hostname === "localhost") {
    return "http://localhost:3000";
  }

  // Production: same domain as frontend
  return window.location.origin;
};

const API_BASE = getApiUrl();
export const API_URL = `${API_BASE}/api`;

console.log("🔌 API Configuration:", {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE,
  API_URL,
});

/* -------------------------------------------------------
   AXIOS INSTANCE
------------------------------------------------------- */
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach token to requests
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

/* -------------------------------------------------------
   AUTH
------------------------------------------------------- */
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
    apiClient.post("/auth/reset-password", {
      token,
      newPassword: password,
    }),

  verifyEmail: (token) =>
    apiClient.get(`/auth/verify-email?token=${token}`),

  resendVerification: (email) =>
    apiClient.post("/auth/resend-verification", { email }),

  getCurrentUser: () => apiClient.get("/auth/me"),

  logout: () => apiClient.post("/auth/logout"),
};

// For Google OAuth organizer dashboard callback
export const handleOrganizerOAuthCallback = async (code) => {
  const res = await apiClient.post("/auth/google/callback", { code });
  return res.data;
};

/* -------------------------------------------------------
   TEAMS
------------------------------------------------------- */
export const teams = {
  getAll: () => apiClient.get("/teams"),
  getById: (id) => apiClient.get(`/teams/${id}`),
  create: (data) => apiClient.post("/teams", data),
  update: (id, data) => apiClient.put(`/teams/${id}`, data),
  remove: (id) => apiClient.delete(`/teams/${id}`),
};

/* -------------------------------------------------------
   BOOKINGS
------------------------------------------------------- */
export const bookings = {
  getAll: () => apiClient.get("/bookings"),
  list: (params) => apiClient.get("/bookings", { params }),
  getById: (id) => apiClient.get(`/bookings/${id}`),

  // 🔹 IMPORTANT: used by /manage/:bookingToken page
  getByToken: (token) => apiClient.get(`/bookings/token/${token}`),

  cancel: (id, data) => apiClient.post(`/bookings/${id}/cancel`, data),
};

/* -------------------------------------------------------
   AVAILABILITY
------------------------------------------------------- */
export const availability = {
  getMemberAvailability: (id) =>
    apiClient.get(`/team-members/${id}/availability`),

  updateMemberAvailability: (id, data) =>
    apiClient.put(`/team-members/${id}/availability`, data),
};

/* -------------------------------------------------------
   BOOKING LINKS (Organizer personal link)
------------------------------------------------------- */
export const bookingLinks = {
  getMyLinks: () => apiClient.get("/booking-links"),
  create: (data) => apiClient.post("/booking-links", data),
  update: (id, data) => apiClient.put(`/booking-links/${id}`, data),
  remove: (id) => apiClient.delete(`/booking-links/${id}`),
};

/* -------------------------------------------------------
   DASHBOARD
------------------------------------------------------- */
export const dashboard = {
  getStats: () => apiClient.get("/dashboard/stats"),
};

/* -------------------------------------------------------
   AI
------------------------------------------------------- */
export const ai = {
  schedulerChat: (payload) =>
    apiClient.post("/ai/scheduler/chat", payload),
};

export default apiClient;
