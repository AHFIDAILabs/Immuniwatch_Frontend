import axios from 'axios';

export const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,          // send HttpOnly cookies on every request
  headers:         { 'Content-Type': 'application/json' },
});

// ── Silent token refresh on 401 ───────────────────────────────────────────────

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

function drainQueue(err: unknown) {
  pendingQueue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve()));
  pendingQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Don't retry non-401s, already-retried requests, or the refresh call itself
    if (
      err.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then(() => api(original))
        .catch((e) => Promise.reject(e));
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      // The refresh_token cookie is sent automatically (it's HttpOnly)
      await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      drainQueue(null);
      return api(original);
    } catch (refreshErr) {
      drainQueue(refreshErr);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
