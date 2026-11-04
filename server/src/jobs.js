import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { spawnDownload, formatArgs, cleanError } from './ytdlp.js';

const jobs = new Map();
const queue = [];
let running = 0;

fs.mkdirSync(config.downloadDir, { recursive: true });

const PROGRESS_RE = /\[download\]\s+([\d.]+)%(?:\s+of\s+~?\s*([\d.]+\w+))?(?:\s+at\s+([\d.]+\w+\/s|Unknown speed))?(?:\s+ETA\s+([\d:]+|Unknown))?/;

function publicView(job) {
  const { id, status, progress, speed, eta, size, error, filename, title, createdAt } = job;
  return { id, status, progress, speed, eta, size, error, filename, title, createdAt };
}

function update(job, patch) {
  Object.assign(job, patch);
  job.events.emit('update', publicView(job));
}

export function createJob({ url, choice, title }) {
  const job = {
    id: randomUUID(),
    url,
    choice,
    title: title || null,
    status: 'queued',
    progress: 0,
    speed: null,
    eta: null,
    size: null,
    error: null,
    filename: null,
    filePath: null,
    createdAt: Date.now(),
    events: new EventEmitter(),
    proc: null,
  };
  job.events.setMaxListeners(20);
  jobs.set(job.id, job);
  queue.push(job);
  pump();
  return publicView(job);
}

function pump() {
  while (running < config.maxJobs && queue.length) {
    const job = queue.shift();
    if (job.status === 'cancelled') continue;
    start(job);
  }
}

function start(job) {
  running++;
  const dir = path.join(config.downloadDir, job.id);
  fs.mkdirSync(dir, { recursive: true });
  update(job, { status: 'downloading' });

  const args = [
    ...formatArgs(job.choice),
    '--restrict-filenames',
    '--trim-filenames', '120',
    '-o', path.join(dir, '%(title)s.%(ext)s'),
    '--', job.url,
  ];
  const proc = spawnDownload(args);
  job.proc = proc;
  let stderr = '';
  let buf = '';

  proc.stdout.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const m = PROGRESS_RE.exec(line);
      if (m) {
        update(job, {
          progress: Math.min(100, parseFloat(m[1])),
          size: m[2] || job.size,
          speed: m[3] && m[3] !== 'Unknown speed' ? m[3] : job.speed,
          eta: m[4] && m[4] !== 'Unknown' ? m[4] : null,
        });
      } else if (/\[(Merger|ExtractAudio|VideoConvertor|FixupM3u8)\]/.test(line)) {
        update(job, { status: 'processing', progress: 100 });
      }
    }
  });
  proc.stderr.on('data', (d) => (stderr += d));

  const finish = (patch) => {
    running--;
    job.proc = null;
    update(job, patch);
    setTimeout(() => removeJob(job.id), config.fileTtlMs).unref();
    pump();
  };

  proc.on('error', (e) => {
    finish({ status: 'error', error: e.code === 'ENOENT' ? 'yt-dlp is not installed on the server' : e.message });
  });

  proc.on('close', (code) => {
    if (job.status === 'cancelled') return finish({ status: 'cancelled' });
    if (code !== 0) return finish({ status: 'error', error: cleanError(stderr) || 'Download failed' });
    const file = fs
      .readdirSync(dir)
      .filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'))
      .map((f) => ({ f, s: fs.statSync(path.join(dir, f)).size }))
      .sort((a, b) => b.s - a.s)[0];
    if (!file) return finish({ status: 'error', error: 'Output file not found' });
    finish({ status: 'done', progress: 100, filename: file.f, filePath: path.join(dir, file.f) });
  });
}

export function getJob(id) {
  return jobs.get(id);
}

export { publicView };

export function cancelJob(id) {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === 'queued') {
    update(job, { status: 'cancelled' });
    setTimeout(() => removeJob(id), 5_000).unref();
  } else if (job.proc) {
    job.status = 'cancelled';
    job.proc.kill('SIGTERM');
  }
  return true;
}

function removeJob(id) {
  const job = jobs.get(id);
  if (!job) return;
  if (job.proc) job.proc.kill('SIGKILL');
  jobs.delete(id);
  fs.rm(path.join(config.downloadDir, id), { recursive: true, force: true }, () => {});
}

export function shutdown() {
  for (const job of jobs.values()) job.proc?.kill('SIGKILL');
  fs.rmSync(config.downloadDir, { recursive: true, force: true });
}

// Clear leftovers from a previous run
for (const entry of fs.readdirSync(config.downloadDir)) {
  fs.rmSync(path.join(config.downloadDir, entry), { recursive: true, force: true });
}
