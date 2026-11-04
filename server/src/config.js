import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT) || 4000,
  ytdlp: process.env.YTDLP_PATH || 'yt-dlp',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
  maxJobs: Number(process.env.MAX_CONCURRENT_JOBS) || 3,
  fileTtlMs: (Number(process.env.FILE_TTL_MINUTES) || 30) * 60_000,
  cookiesFile: process.env.COOKIES_FILE || '',
  downloadDir: path.join(root, 'downloads'),
  clientDist: path.resolve(root, '..', 'client', 'dist'),
};
