import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
  headers:         { 'Content-Type': 'application/json' },
});

// ── Silent token refresh on 401 ───────────────────────────────────────────────

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

function drainQueue(err: Error | null) {
  pendingQueue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve()));
  pendingQueue = [];
}

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as RetryConfig | undefined;

    if (
      err.response?.status !== 401 ||
      !original ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login')
    ) {
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then(() => api(original))
        .catch((e: unknown) => Promise.reject(e instanceof Error ? e : new Error(String(e))));
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      drainQueue(null);
      return api(original);
    } catch (refreshErr: unknown) {
      const asError = refreshErr instanceof Error ? refreshErr : new Error(String(refreshErr));
      drainQueue(asError);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(asError);
    } finally {
      isRefreshing = false;
    }
  },
);
