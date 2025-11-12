// client/src/utils/api.js
import axios from 'axios';

const clean = (u) => (u || '').replace(/\/+$/, ''); // strip trailing slashes
const API_URL = clean(import.meta.env.VITE_API_URL); // should be .../api

const api = axios.create({
  baseURL: API_URL, // e.g. https://.../api
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  googleLogin: (code) => api.post('/auth/google', { code }), // renamed here
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

export const bookings = {
  getAll: () => api.get('/api/bookings'),
  getByToken: (token) => api.get(`/api/book/${encodeURIComponent(token)}`), // <-- add /api
  create: (data) => api.post('/api/bookings', data),
  getAvailability: (token, date) => api.get(`/api/book/${encodeURIComponent(token)}/availability?date=${encodeURIComponent(date)}`),
};



export default api;
