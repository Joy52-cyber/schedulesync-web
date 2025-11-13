// client/src/utils/api.js
import axios from 'axios';

const clean = (u) => (u || '').replace(/\/+$/, ''); // strip trailing slashes
// VITE_API_URL should be https://schedulesync-web-production.up.railway.app/api
const API_URL = clean(import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_URL, // e.g. https://.../api
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 🔹 Export googleLogin as a standalone function AND inside auth
export const googleLogin = (codeOrPayload) => {
  const payload = typeof codeOrPayload === 'string'
    ? { code: codeOrPayload }
    : codeOrPayload;
  return api.post('/auth/google', payload);
};

export const auth = {
  googleLogin, // still available as auth.googleLogin
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const analytics = {
  getStats: () => Promise.resolve({ totalUsers: 0, totalBookings: 0 }),
};

export const teams = {
  getAll: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),
  getMembers: (teamId) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId, memberId) => api.delete(`/teams/${teamId}/members/${memberId}`),
  updateMemberExternalLink: (teamId, memberId, data) =>
    api.put(`/teams/${teamId}/members/${memberId}/external-link`, data),
};

// ⚠️ baseURL already includes /api, so don't prefix these with /api again
export const bookings = {
  getAll: () => api.get('/bookings'),
  getByToken: (token) => api.get(`/book/${encodeURIComponent(token)}`),
  create: (data) => api.post('/bookings', data),
  getAvailability: (token, date) =>
    api.get(`/book/${encodeURIComponent(token)}/availability`, {
      params: { date },
    }),
};

export default api;
