# Downloader

A video and audio downloader with a React (Vite) frontend and a Node.js (Express) backend. It uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), which supports YouTube, Instagram, TikTok, X, Facebook, Vimeo, Reddit and 1000+ other sites.

## Features
- Paste a link to see the title, thumbnail and duration, then pick a quality
- Video (best, 2160p … 144p, MP4) or audio only (MP3 / M4A)
- Download queue with live progress (speed, ETA) over Server-Sent Events
- Cancel downloads; finished files are deleted automatically after a TTL
- Rate limiting, Helmet, URL validation, basic SSRF guard, no shell execution
- Responsive UI with automatic light/dark mode

## Requirements
- Node.js 20+
- yt-dlp: `pip install -U yt-dlp` (keep it updated, since sites change often)
- ffmpeg, for merging video and audio and converting to MP3

## Setup
```bash
npm install
npm run install:all
cp server/.env.example server/.env
npm run dev
```
Frontend: http://localhost:5173 · API: http://localhost:4000

## Production
```bash
npm run build
npm start
```
The Express server serves the built React app from `client/dist`.

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server status and yt-dlp version |
| POST | `/api/info` | `{ url }` → metadata and format choices |
| POST | `/api/jobs` | `{ url, choice }` → creates a download job |
| GET | `/api/jobs/:id/events` | SSE progress stream |
| GET | `/api/jobs/:id/file` | Download the finished file |
| DELETE | `/api/jobs/:id` | Cancel a job |

## Notes
- Private or login-only content: set `COOKIES_FILE` to a Netscape `cookies.txt`.
- Many hosts block datacenter IPs on YouTube and Instagram, so a residential proxy may be needed.

## Disclaimer
For personal use with content you own or have permission to download. Respect each platform's terms of service and copyright law.
