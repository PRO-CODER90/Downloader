// Downloads the standalone yt-dlp Linux binary into ./bin during the Vercel build.
// Locally (non-Vercel) it is skipped; install yt-dlp yourself: pip install -U yt-dlp
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'bin', 'yt-dlp');
const SRC = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

if (!process.env.VERCEL && !process.env.FORCE_YTDLP_DOWNLOAD) {
  console.log('[yt-dlp] Not on Vercel — skipping binary download (using system yt-dlp).');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
console.log('[yt-dlp] Downloading', SRC);
const res = await fetch(SRC, { redirect: 'follow' });
if (!res.ok) {
  console.error(`[yt-dlp] Download failed: ${res.status}`);
  process.exit(1);
}
fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
fs.chmodSync(dest, 0o755);
console.log(`[yt-dlp] Saved to ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
