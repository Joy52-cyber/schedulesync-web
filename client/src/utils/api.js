// client/src/utils/api.js
import axios from "axios";

// --------------------------------------------------
// Resolve correct API base URL
// --------------------------------------------------
const getApiUrl = () => {
  const viteUrl = import.meta.env.VITE_API_URL;

  if (viteUrl) {
    return viteUrl.replace(/\/+$/, "").replace(/\/api$/, "");
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

// --------------------------------------------------
// Axios client
// --------------------------------------------------
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach Authorization header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle Unauthorized globally
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

// --------------------------------------------------
// AUTH
// --------------------------------------------------
export const auth = {
  googleLogin: (codeOrPayload) => {
    let payload = codeOrPayload;

    if (typeof codeOrPayload === "string") {
      payload = {
        code: codeOrPayload,
        redirectUri: `${window.location.origin}/login`,
      };
    }

    return apiClient.post("/auth/google", payload);
  },

  register: (data) => apiClient.post("/auth/register", data),
  login: (data) => apiClient.post("/auth/login", data),

  forgotPassword: (email) =>
    apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (token, newPassword) =>
    apiClient.post("/auth/reset-password", { token, newPassword }),

  verifyEmail: (token) =>
    apiClient.get(`/auth/verify-email?token=${token}`),

  resendVerification: (email) =>
    apiClient.post("/auth/resend-verification", { email }),

  getCurrentUser: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout"),

  createTestUser: () => apiClient.get("/auth/create-test-user"),
};

export const googleLogin = auth.googleLogin;

// --------------------------------------------------
// ORGANIZER OAUTH CALLBACK
// --------------------------------------------------
export const handleOrganizerOAuthCallback = async (code) => {
  const payload = {
    code,
    redirectUri: `${window.location.origin}/oauth/callback`,
  };
  const res = await apiClient.post("/auth/google", payload);
  return res.data;
};

// Get Google OAuth URL
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
  getPublic: (token) =>
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
// DASHBOARD
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
