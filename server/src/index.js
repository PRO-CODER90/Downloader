import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import { config } from './config.js';
import { getInfo, version, VALID_CHOICE } from './ytdlp.js';
import { createJob, getJob, cancelJob, publicView, shutdown } from './jobs.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10kb' }));

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api/', apiLimiter);

function parseUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  try {
    const u = new URL(input.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    // Block obvious internal targets (basic SSRF guard)
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\])/i.test(u.hostname)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    res.json({ ok: true, ytdlp: await version() });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.post('/api/info', async (req, res) => {
  const url = parseUrl(req.body?.url);
  if (!url) return res.status(400).json({ error: 'Please enter a valid http(s) URL' });
  try {
    res.json(await getInfo(url));
  } catch (e) {
    res.status(422).json({ error: e.message || 'Could not fetch media info' });
  }
});

app.post('/api/jobs', (req, res) => {
  const url = parseUrl(req.body?.url);
  const choice = req.body?.choice || 'best';
  if (!url) return res.status(400).json({ error: 'Please enter a valid http(s) URL' });
  if (!VALID_CHOICE.test(choice)) return res.status(400).json({ error: 'Invalid format choice' });
  const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 200) : null;
  res.status(201).json(createJob({ url, choice, title }));
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(publicView(job));
});

// Server-Sent Events stream for live progress
app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send(publicView(job));
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
  job.events.on('update', send);
  req.on('close', () => {
    clearInterval(ping);
    job.events.off('update', send);
  });
});

app.get('/api/jobs/:id/file', (req, res) => {
  const job = getJob(req.params.id);
  if (!job || job.status !== 'done' || !job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).json({ error: 'File not available' });
  }
  res.download(job.filePath, job.filename);
});

app.delete('/api/jobs/:id', (req, res) => {
  if (!cancelJob(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  res.status(204).end();
});

// Serve built React app in production
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile('index.html', { root: config.clientDist }));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error' });
});

const server = app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shutdown();
    server.close(() => process.exit(0));
  });
}
