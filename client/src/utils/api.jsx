import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  googleLogin: (code) => api.post('/api/auth/google', { code }),
  microsoftLogin: (code) => api.post('/api/auth/microsoft', { code }),
};

export const calendar = {
  getEvents: () => api.get('/api/calendar/events'),
};

export const teams = {
  getAll: () => api.get('/api/teams'),
  create: (data) => api.post('/api/teams', data),
  update: (id, data) => api.put(`/api/teams/${id}`, data),
  delete: (id) => api.delete(`/api/teams/${id}`),
  getMembers: (id) => api.get(`/api/teams/${id}/members`),
  addMember: (id, data) => api.post(`/api/teams/${id}/members`, data),
  removeMember: (teamId, memberId) => api.delete(`/api/teams/${teamId}/members/${memberId}`),
};

export const bookings = {
  getAll: () => api.get('/api/bookings'),
  create: (data) => api.post('/api/bookings', data),
  getByToken: (token) => api.get(`/api/book/${token}`),
  suggestSlots: (data) => api.post('/api/suggest-slots', data),
};

export const analytics = {
  get: () => api.get('/api/analytics'),
};

export default api;