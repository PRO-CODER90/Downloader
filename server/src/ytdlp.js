import { spawn } from 'node:child_process';
import { config } from './config.js';

const baseArgs = () => {
  const args = ['--no-playlist', '--no-warnings', '--ignore-config'];
  if (config.cookiesFile) args.push('--cookies', config.cookiesFile);
  return args;
};

/** Run yt-dlp and collect stdout. Arguments are passed as an array (no shell). */
export function run(args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ytdlp, [...baseArgs(), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? 'yt-dlp is not installed on the server' : e.message));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(cleanError(err) || `yt-dlp exited with code ${code}`));
    });
  });
}

export function cleanError(stderr) {
  const line = stderr.split('\n').reverse().find((l) => l.includes('ERROR'));
  return (line || stderr.trim().split('\n').pop() || '').replace(/^ERROR:\s*/, '').slice(0, 300);
}

/** Spawn a download process; caller handles events. */
export function spawnDownload(args) {
  return spawn(config.ytdlp, [...baseArgs(), '--newline', '--progress', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function version() {
  return (await run(['--version'], { timeoutMs: 10_000 })).trim();
}

/** Fetch metadata and build a simplified list of format choices. */
export async function getInfo(url) {
  const raw = JSON.parse(await run(['-J', url], { timeoutMs: 90_000 }));
  const formats = Array.isArray(raw.formats) ? raw.formats : [];

  const heights = [...new Set(formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height).map((f) => f.height))]
    .sort((a, b) => b - a);

  const sizeFor = (h) => {
    const v = formats
      .filter((f) => f.height === h && f.vcodec !== 'none')
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
    const a = formats.filter((f) => f.vcodec === 'none' && f.acodec !== 'none').sort((x, y) => (y.abr || 0) - (x.abr || 0))[0];
    const vs = v?.filesize || v?.filesize_approx || 0;
    const as = v?.acodec && v.acodec !== 'none' ? 0 : a?.filesize || a?.filesize_approx || 0;
    return vs + as || null;
  };

  const choices = [
    { id: 'best', label: 'Best quality', type: 'video', ext: 'mp4', size: null },
    ...heights.map((h) => ({ id: `v${h}`, label: `${h}p`, type: 'video', ext: 'mp4', size: sizeFor(h) })),
    { id: 'audio-mp3', label: 'Audio (MP3)', type: 'audio', ext: 'mp3', size: null },
    { id: 'audio-m4a', label: 'Audio (M4A)', type: 'audio', ext: 'm4a', size: null },
  ];

  return {
    title: raw.title || 'Untitled',
    uploader: raw.uploader || raw.channel || raw.uploader_id || null,
    duration: raw.duration || null,
    thumbnail: raw.thumbnail || raw.thumbnails?.at(-1)?.url || null,
    site: raw.extractor_key || raw.extractor || 'Unknown',
    webpageUrl: raw.webpage_url || url,
    choices,
  };
}

/** Map a choice id to yt-dlp arguments. */
export function formatArgs(choice) {
  if (choice === 'audio-mp3') return ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0'];
  if (choice === 'audio-m4a') return ['-f', 'bestaudio[ext=m4a]/bestaudio/best', '-x', '--audio-format', 'm4a'];
  const m = /^v(\d{2,4})$/.exec(choice);
  const h = m ? `[height<=${m[1]}]` : '';
  return ['-f', `bv*${h}+ba/b${h}/b`, '--merge-output-format', 'mp4'];
}

export const VALID_CHOICE = /^(best|v\d{2,4}|audio-mp3|audio-m4a)$/;
