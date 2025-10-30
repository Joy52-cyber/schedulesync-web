import axios from 'axios';

// Use VITE_API_URL from env, fallback to empty string for production (same origin)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000');

console.log('🔗 API URL:', API_URL);

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      console.log('❌ Authentication failed, logging out...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const auth = {
  googleLogin: (code) => api.post('/api/auth/google', { code }),
  microsoftLogin: (code) => api.post('/api/auth/microsoft', { code }),
  logout: () => api.post('/api/auth/logout'),
};

export const teams = {
  getAll: () => api.get('/api/teams'),
  create: (data) => api.post('/api/teams', data),
  update: (id, data) => api.put(`/api/teams/${id}`, data),
  delete: (id) => api.delete(`/api/teams/${id}`),
  getMembers: (teamId) => api.get(`/api/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/api/teams/${teamId}/members`, data),
  removeMember: (teamId, memberId) => api.delete(`/api/teams/${teamId}/members/${memberId}`),
};

export const calendar = {
  getEvents: () => api.get('/api/calendar/events'),
  syncCalendar: () => api.post('/api/calendar/sync'),
};

export const analytics = {
  get: () => api.get('/api/analytics'),
};

export const availability = {
  get: () => api.get('/api/availability'),
  set: (data) => api.post('/api/availability', data),
};

export const bookings = {
  getAll: () => api.get('/api/bookings'),
  getByToken: (token) => api.get(`/api/book/${token}`),
  create: (data) => api.post('/api/bookings', data),
  getAvailability: (token, date) => api.get(`/api/book/${token}/availability?date=${date}`),
};