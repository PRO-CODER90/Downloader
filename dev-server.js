// Local API server that mounts the same handlers Vercel runs from /api.
import http from 'node:http';
import health from './api/health.js';
import info from './api/info.js';
import download from './api/download.js';

const routes = { '/api/health': health, '/api/info': info, '/api/download': download };
const port = Number(process.env.PORT) || 4000;

http
  .createServer(async (req, res) => {
    const handler = routes[new URL(req.url, 'http://x').pathname];
    if (!handler) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    try {
      await handler(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`API dev server on http://localhost:${port}`));
