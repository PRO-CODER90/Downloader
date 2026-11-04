/** Small helpers shared by the API handlers (works on Vercel and the local dev server). */
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 10_000) throw new Error('Body too large');
  }
  return JSON.parse(data || '{}');
}

export function query(req) {
  return req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}
