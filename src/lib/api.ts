// src/lib/api.ts
// Enterprise Axios instance with automatic mutation toast notifications,
// Bearer token injection, transparent 401 token refresh queue, and ApiError normalization.

import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { toApiError } from './errors';
import { getAccessToken, redirectToLogin, useAuthStore } from '@/stores/auth-store';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Suppress the automatic success toast notification for mutations */
    silent?: boolean;
    /** Custom success toast message to display instead of the server message */
    successMessage?: string;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Mutex & pending queue for transparent token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: inject Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to extract a human-readable success message
function extractSuccessMessage(data: any, method: string): string | null {
  if (!data) return null;
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (data.data && typeof data.data === 'object' && typeof data.data.message === 'string') {
    return data.data.message.trim();
  }
  // Fallbacks based on HTTP method
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'POST') return 'Created successfully';
  if (upperMethod === 'PUT' || upperMethod === 'PATCH') return 'Changes saved successfully';
  if (upperMethod === 'DELETE') return 'Deleted successfully';
  return null;
}

// Response Interceptor: Auto-toast on mutations + 401 transparent refresh
api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || 'get').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const silent = Boolean(response.config.silent);

    // Don't auto-toast login or refresh endpoints as they have bespoke flows
    const url = response.config.url || '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');

    if (isMutation && !silent && !isAuthRoute) {
      const customMessage = response.config.successMessage;
      const message = customMessage || extractSuccessMessage(response.data, method);
      if (message) {
        toast.success(message);
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Account still on a temporary password: no access until it's changed.
    const body = error.response?.data as { code?: string; message?: string; error?: { code?: string } } | undefined;
    const errorCode = body?.error?.code ?? body?.code;
    const needsNewPassword =
      errorCode === 'PASSWORD_CHANGE_REQUIRED' || /set a new password/i.test(String(body?.message ?? ''));
    if (error.response?.status === 403 && needsNewPassword) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        toast.error('Set a new password to keep using the admin. Sign in again.');
      }
      redirectToLogin();
      return Promise.reject(toApiError(error));
    }

    // 401 Unauthorized handling (Transparent refresh with HttpOnly cookie)
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const url = originalRequest.url || '';
      // Avoid infinite loop if the refresh endpoint itself returns 401
      if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
        return Promise.reject(toApiError(error));
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(toApiError(err)));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true, headers: { Accept: 'application/json' } }
        );

        const newAccessToken =
          refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;

        if (newAccessToken) {
          useAuthStore.getState().setAccessToken(newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error('Refresh response did not return an access token');
        }
      } catch (refreshErr) {
        processQueue(refreshErr as Error, null);
        const refreshStatus = (refreshErr as AxiosError)?.response?.status;
        // Server unreachable (no response) or failing (5xx): keep the session and
        // surface the error instead of logging the admin out.
        if (!refreshStatus || refreshStatus >= 500) {
          return Promise.reject(toApiError(refreshErr));
        }

        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          toast.error('Your session has expired. Please sign in again.');
        }
        redirectToLogin();
        return Promise.reject(toApiError(refreshErr));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(toApiError(error));
  }
);
