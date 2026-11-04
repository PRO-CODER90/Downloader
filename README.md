# Downloader

A video and audio downloader with a React (Vite) frontend and Node.js serverless functions, built to deploy on **Vercel**. It uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), which supports YouTube, Instagram, TikTok, X, Facebook, Vimeo, Reddit and 1000+ other sites.

## Two backends, one frontend
| | **Render (Full)** `server/` | **Vercel (Lite)** `api/` |
|---|---|---|
| Quality | Best / 4K / 1080p… (merged with ffmpeg) | Single-file formats only (YouTube ≈ 360p) |
| Audio | MP3 / M4A conversion | Original M4A / WebM |
| Progress | Live progress, queue, cancel (SSE) | Browser's download bar |
| Hosting | Docker container | Serverless functions |

The frontend checks `/api/health` (`mode: "jobs"` or `"direct"`) and switches its download flow automatically.

## Option A (recommended): everything on Render
The Docker image builds the React app and serves it with the full API, so one service hosts everything.
1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint**, pick this repo, and Render reads `render.yaml`. You can also choose **New → Web Service → Docker**.
3. Optional: to work around YouTube and Instagram bot checks, add a **Secret File** named `cookies.txt`, or set the `YTDLP_COOKIES` env var.
4. Open `https://<your-service>.onrender.com`.

> Use the **Starter** plan or higher. The free plan sleeps when idle and has too little RAM for ffmpeg merges.

## Option B: frontend on Vercel, backend on Render
1. Deploy the backend to Render as in Option A.
2. In Vercel, import the repo and add the env var `VITE_API_URL=https://<your-service>.onrender.com`, then deploy.
3. In Render, set `CORS_ORIGIN=https://<your-app>.vercel.app`.

## Option C: everything on Vercel (Lite)
Import the repo in Vercel with no env vars. `vercel.json` sets up the `/api` functions, and the yt-dlp binary is downloaded at build time. You can optionally set `YTDLP_COOKIES`.

Lite-mode limits: no merging (no ffmpeg), 300 s maximum function duration, and streamed bytes count toward Vercel bandwidth.

## Local development
Requires Node 20+, `pip install -U yt-dlp`, and ffmpeg (needed for full mode).
```bash
npm run install:all
npm run dev:full
npm run dev
```
`npm run dev:full` runs the Render-style backend. `npm run dev` runs the Vercel-style backend. The frontend is at http://localhost:5173 in both cases.

Docker:
```bash
docker build -t downloader .
docker run -p 10000:10000 downloader
```

## API
**Full (`server/`)**: `GET /api/health`, `POST /api/info`, `POST /api/jobs {url, choice}`, `GET /api/jobs/:id/events` (SSE), `GET /api/jobs/:id/file`, `DELETE /api/jobs/:id`

**Lite (`api/`)**: `GET /api/health`, `POST /api/info`, `GET /api/download?url=…&f=<formatId>`

## Notes
- YouTube and Instagram often block cloud IPs. Cookies or a residential proxy help.
- Keep yt-dlp updated, since sites change often. Redeploy on Render to pull the latest yt-dlp.

## Security
- **No secrets in the frontend.** The only frontend variable is `VITE_API_URL`, a public URL. Cookies (`YTDLP_COOKIES`) stay server-side and are written to disk with `0600` permissions.
- **SSRF protection** (`ssrf.js`): only http(s) on ports 80 and 443 is allowed, and URLs containing credentials are rejected. Every resolved IP must be public, so loopback, private, link-local, cloud metadata, CGNAT and IPv4-mapped addresses are blocked. Every redirect hop is re-checked during streaming.
- **Generic extractor off by default:** only known sites (YouTube, Instagram, TikTok…) are allowed. `ALLOW_GENERIC_EXTRACTOR=true` enables arbitrary sites, which carries more risk.
- **No shell:** yt-dlp is spawned with an argument array, URLs come after `--`, and format choices are allow-listed.
- **Abuse limits (Render):** rate limits of 60 req/min per IP and 20 jobs per 10 min, at most 3 simultaneous jobs per IP, a queue cap, a 2 GB maximum file size, a 30-minute job timeout, and automatic file cleanup.
- **Headers:** a strict CSP, `frame-ancestors 'none'`, `nosniff` and HSTS (Vercel). CORS is same-origin only unless `CORS_ORIGIN` is set.
- **Supply chain:** the yt-dlp binary is verified against the release's SHA-256 checksums on Vercel. You can pin a version with `YTDLP_VERSION`. The Docker image runs as a non-root user, and `npm audit` reports 0 vulnerabilities.
- **Vercel rate limiting:** serverless functions don't share memory, so add a rate-limit rule in **Vercel → Firewall** (for example, 30 requests per minute per IP on `/api/*`).

## Disclaimer
For personal use with content you own or have permission to download. Respect each platform's terms of service and copyright law.
