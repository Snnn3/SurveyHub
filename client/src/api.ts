import axios from 'axios';

export const SESSION_EXPIRED_EVENT = 'surveyhub:session-expired';

const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;
