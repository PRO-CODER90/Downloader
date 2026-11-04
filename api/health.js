import { version } from '../lib/ytdlp.js';
import { send } from '../lib/http.js';

export default async function handler(_req, res) {
  try {
    send(res, 200, { ok: true, mode: 'direct', ytdlp: await version() });
  } catch (e) {
    send(res, 503, { ok: false, error: e.message });
  }
}
