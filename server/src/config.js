import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

function resolveCookies() {
  if (process.env.COOKIES_FILE) return process.env.COOKIES_FILE;
  if (fs.existsSync('/etc/secrets/cookies.txt')) return '/etc/secrets/cookies.txt'; // Render secret file
  if (process.env.YTDLP_COOKIES) {
    const p = path.join(os.tmpdir(), 'yt-dlp-cookies.txt');
    fs.writeFileSync(p, process.env.YTDLP_COOKIES.replace(/\\n/g, '\n'));
    return p;
  }
  return '';
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT) || 4000,
  ytdlp: process.env.YTDLP_PATH || 'yt-dlp',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
  maxJobs: Number(process.env.MAX_CONCURRENT_JOBS) || 3,
  fileTtlMs: (Number(process.env.FILE_TTL_MINUTES) || 30) * 60_000,
  cookiesFile: resolveCookies(),
  downloadDir: path.join(root, 'downloads'),
  clientDist: path.resolve(root, '..', 'client', 'dist'),
};
