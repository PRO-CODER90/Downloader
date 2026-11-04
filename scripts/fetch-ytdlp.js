// Downloads the standalone yt-dlp Linux binary into ./bin during the Vercel build.
// Locally (non-Vercel) it is skipped; install yt-dlp yourself: pip install -U yt-dlp
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'bin', 'yt-dlp');
import crypto from 'node:crypto';

// Pin a release with YTDLP_VERSION (e.g. 2026.10.26); defaults to latest.
const REL = process.env.YTDLP_VERSION
  ? `https://github.com/yt-dlp/yt-dlp/releases/download/${process.env.YTDLP_VERSION}`
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
const SRC = `${REL}/yt-dlp_linux`;

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
const bin = Buffer.from(await res.arrayBuffer());

// Verify against the release's published SHA-256 checksums
const sums = await fetch(`${REL}/SHA2-256SUMS`, { redirect: 'follow' }).then((r) => (r.ok ? r.text() : ''));
const expected = sums.split('\n').map((l) => l.trim().split(/\s+/)).find(([, name]) => name === 'yt-dlp_linux')?.[0];
const actual = crypto.createHash('sha256').update(bin).digest('hex');
if (!expected || expected.toLowerCase() !== actual) {
  console.error(`[yt-dlp] Checksum verification failed (expected ${expected}, got ${actual})`);
  process.exit(1);
}
console.log('[yt-dlp] SHA-256 verified');
fs.writeFileSync(dest, bin);
fs.chmodSync(dest, 0o755);
console.log(`[yt-dlp] Saved to ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
