import { signal, effect } from '@preact/signals';
import { useRef, useCallback } from 'preact/hooks';

const TOKEN_KEY = 'dvhub-token';

/**
 * Fetch wrapper with auth token and JSON content-type.
 */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = new URL(path, window.location.origin);
  return fetch(url.toString(), { ...options, headers });
}

/**
 * Hook that fetches JSON from an API path and returns reactive signals.
 * Returns { data, loading, error, refresh }
 */
export function useApi(path) {
  const data = signal(null);
  const loading = signal(false);
  const error = signal(null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data.value = await res.json();
    } catch (err) {
      error.value = err.message || 'Fetch failed';
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, refresh };
}
