const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  info: (url) => request('/api/info', { method: 'POST', body: JSON.stringify({ url }) }),
  createJob: (body) => request('/api/jobs', { method: 'POST', body: JSON.stringify(body) }),
  cancelJob: (id) => request(`/api/jobs/${id}`, { method: 'DELETE' }),
  events: (id) => new EventSource(`${BASE}/api/jobs/${id}/events`),
  fileUrl: (id) => `${BASE}/api/jobs/${id}/file`,
};
