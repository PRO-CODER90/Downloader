import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundled = path.join(root, 'bin', 'yt-dlp');

/** Bundled binary (Vercel) → YTDLP_PATH → system yt-dlp (local). */
function binary() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  if (fs.existsSync(bundled)) return bundled;
  return 'yt-dlp';
}

/**
 * The "generic" extractor fetches arbitrary pages, which widens SSRF exposure.
 * Disabled unless ALLOW_GENERIC_EXTRACTOR=true (known sites like YouTube/Instagram still work).
 */
function extractorArgs() {
  return process.env.ALLOW_GENERIC_EXTRACTOR === 'true' ? [] : ['--use-extractors', 'default,-generic'];
}

let cookiesPath = null;
/** Cookies can be provided as env var content (Vercel has no persistent files). */
function cookies() {
  const content = process.env.YTDLP_COOKIES;
  if (!content) return [];
  if (!cookiesPath) {
    cookiesPath = path.join('/tmp', 'yt-dlp-cookies.txt');
    fs.writeFileSync(cookiesPath, content.replace(/\\n/g, '\n'), { mode: 0o600 });
  }
  return ['--cookies', cookiesPath];
}

function run(args, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      binary(),
      ['--ignore-config', '--no-playlist', '--no-warnings', '--cache-dir', '/tmp/yt-dlp-cache', ...extractorArgs(), ...cookies(), ...args],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HOME: process.env.HOME || '/tmp' } },
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? 'yt-dlp is not available on the server' : e.message));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(out);
      const line = err.split('\n').reverse().find((l) => l.includes('ERROR')) || err.trim().split('\n').pop() || '';
      reject(new Error(line.replace(/^ERROR:\s*/, '').slice(0, 300) || `yt-dlp exited with code ${code}`));
    });
  });
}

export async function version() {
  return (await run(['--version'], 15_000)).trim();
}

export { safeUrl as parseUrl } from './ssrf.js';

export const VALID_FORMAT = /^[\w][\w.+-]{0,63}$/;

// Only formats that are a single direct file can be streamed without ffmpeg.
const isDirect = (f) => ['https', 'http'].includes(f.protocol) && f.url;
const hasVideo = (f) => f.vcodec && f.vcodec !== 'none';
const hasAudio = (f) => f.acodec && f.acodec !== 'none';
const size = (f) => f.filesize || f.filesize_approx || null;

export async function getInfo(url) {
  const raw = JSON.parse(await run(['-J', '--', url]));
  const formats = (raw.formats?.length ? raw.formats : [raw]).filter(isDirect);

  // Video with audio: best per height, prefer mp4
  const byHeight = new Map();
  for (const f of formats.filter((f) => hasVideo(f) && hasAudio(f))) {
    const key = f.height || 0;
    const cur = byHeight.get(key);
    const score = (x) => (x.ext === 'mp4' ? 1e6 : 0) + (x.tbr || 0);
    if (!cur || score(f) > score(cur)) byHeight.set(key, f);
  }
  const video = [...byHeight.values()]
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .map((f) => ({ id: f.format_id, type: 'video', label: f.height ? `${f.height}p` : 'Video', ext: f.ext, size: size(f) }));

  // Some sites (e.g. generic/direct files) expose formats without codec info
  if (!video.length) {
    const f = formats.find((x) => !hasAudio(x) && !hasVideo(x) && x.vcodec !== 'none');
    if (f) video.push({ id: f.format_id, type: 'video', label: 'Original', ext: f.ext, size: size(f) });
  }

  const audioFormats = formats.filter((f) => hasAudio(f) && !hasVideo(f)).sort((a, b) => (b.abr || 0) - (a.abr || 0));
  const audio = [];
  const m4a = audioFormats.find((f) => f.ext === 'm4a');
  if (m4a) audio.push({ id: m4a.format_id, type: 'audio', label: `Audio M4A${m4a.abr ? ` · ${Math.round(m4a.abr)}k` : ''}`, ext: 'm4a', size: size(m4a) });
  const other = audioFormats.find((f) => f.ext !== 'm4a');
  if (other) audio.push({ id: other.format_id, type: 'audio', label: `Audio ${other.ext.toUpperCase()}${other.abr ? ` · ${Math.round(other.abr)}k` : ''}`, ext: other.ext, size: size(other) });

  return {
    title: raw.title || 'Untitled',
    uploader: raw.uploader || raw.channel || raw.uploader_id || null,
    duration: raw.duration || null,
    thumbnail: raw.thumbnail || raw.thumbnails?.at(-1)?.url || null,
    site: raw.extractor_key || raw.extractor || 'Unknown',
    choices: [...video, ...audio],
  };
}

/** Resolve the direct media URL + headers for one format. */
export async function resolveFormat(url, formatId) {
  const raw = JSON.parse(await run(['-j', '-f', formatId, '--', url]));
  const f = raw.requested_downloads?.[0] || raw;
  if (!f.url || !['https', 'http'].includes(f.protocol)) throw new Error('This format cannot be streamed directly');
  return {
    url: f.url,
    headers: f.http_headers || raw.http_headers || {},
    ext: f.ext || raw.ext || 'mp4',
    title: raw.title || 'download',
  };
}
