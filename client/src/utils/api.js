import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  googleCallback: (code) => api.post('/auth/google', { code }),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
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
  getAll: () => api.get('/bookings'),
  getByToken: (token) => api.get(`/book/${token}`),
  create: (data) => api.post('/bookings', data),
  getAvailability: (token, date) => api.get(`/book/${token}/availability?date=${date}`),
};

export default api;