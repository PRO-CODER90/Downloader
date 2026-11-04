import { getInfo, parseUrl } from '../lib/ytdlp.js';
import { send, readJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: 'Invalid JSON body' });
  }
  const url = await parseUrl(body?.url);
  if (!url) return send(res, 400, { error: 'Please enter a valid http(s) URL' });
  try {
    send(res, 200, await getInfo(url));
  } catch (e) {
    send(res, 422, { error: e.message || 'Could not fetch media info' });
  }
}
