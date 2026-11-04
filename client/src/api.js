const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  info: (url) => request('/api/info', { method: 'POST', body: JSON.stringify({ url }) }),
  downloadUrl: (url, formatId) => `${BASE}/api/download?${new URLSearchParams({ url, f: formatId })}`,
};
