import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseUrl, resolveFormat, VALID_FORMAT } from '../lib/ytdlp.js';
import { send, query } from '../lib/http.js';
import { safeFetch } from '../lib/ssrf.js';

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

function safeName(title, ext) {
  const base = String(title).replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'download';
  return `${base}.${ext}`;
}

/**
 * Resolves the media URL and streams it to the client in the same invocation
 * (many CDNs lock URLs to the IP that extracted them).
 */
export default async function handler(req, res) {
  const q = query(req);
  const url = await parseUrl(q.url);
  const format = q.f || 'b';
  if (!url) return send(res, 400, { error: 'Invalid URL' });
  if (!VALID_FORMAT.test(format)) return send(res, 400, { error: 'Invalid format' });

  let media;
  try {
    media = await resolveFormat(url, format);
  } catch (e) {
    return send(res, 422, { error: e.message });
  }

  const headers = { ...media.headers };
  if (req.headers.range) headers.Range = req.headers.range;

  const ac = new AbortController();
  req.on('close', () => ac.abort());

  let upstream;
  try {
    upstream = await safeFetch(media.url, { headers, signal: ac.signal });
  } catch (e) {
    return send(res, 502, { error: 'Could not reach the media server' });
  }
  if (!upstream.ok || !upstream.body) return send(res, 502, { error: `Upstream responded with ${upstream.status}` });

  res.statusCode = upstream.status;
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  const name = safeName(media.title, media.ext);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch {
    /* client disconnected */
  }
}
