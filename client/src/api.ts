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

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export function getApiErrorStatus(err: unknown): number | undefined {
  if (axios.isAxiosError(err)) {
    return err.response?.status;
  }
  return undefined;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorInfo {
  message: string;
  code?: string;
  details: ApiErrorDetail[];
}

export function parseApiError(err: unknown, fallback: string): ApiErrorInfo {
  if (axios.isAxiosError(err) && err.response?.data?.error) {
    const errorObj = err.response.data.error;
    const message = errorObj.message || fallback;
    const code = errorObj.code;
    const details: ApiErrorDetail[] = [];
    if (Array.isArray(errorObj.details)) {
      errorObj.details.forEach((d: unknown) => {
        if (d && typeof d === 'object') {
          const detail = d as { field?: unknown; message?: unknown };
          if (typeof detail.message === 'string') {
            details.push({
              field: typeof detail.field === 'string' ? detail.field : undefined,
              message: detail.message,
            });
          }
        }
      });
    }
    return { message, code, details };
  }
  return {
    message: getApiErrorMessage(err, fallback),
    details: [],
  };
}

export default api;
