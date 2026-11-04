# Downloader

A video and audio downloader with a React (Vite) frontend and Node.js serverless functions, built to deploy on **Vercel**. It uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), which supports YouTube, Instagram, TikTok, X, Facebook, Vimeo, Reddit and 1000+ other sites.

## How it works
```
Browser ──POST /api/info──▶ Vercel function ──yt-dlp──▶ metadata + formats
Browser ──GET /api/download──▶ Vercel function ──yt-dlp resolves URL──▶ streams file ▶ browser
```
- No storage, queue or ffmpeg is needed, so it fits Vercel's serverless model.
- The file is streamed through the function, so CDN URLs locked to the requesting IP still work. Range requests are supported, so downloads can resume.
- The yt-dlp standalone Linux binary is downloaded during the Vercel build (`scripts/fetch-ytdlp.js`) and bundled into the functions.

## Deploy to Vercel
1. Import this repo at vercel.com/new. The framework preset can stay **Other**, because `vercel.json` configures everything.
2. Optional: add an `YTDLP_COOKIES` env var (the contents of a cookies.txt file) for login-only content or bot checks.
3. Deploy.

## Local development
Requires Node 20+ and `pip install -U yt-dlp`.
```bash
npm run install:all
npm run dev
```
Frontend: http://localhost:5173 (proxies `/api` to http://localhost:4000)

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Status and yt-dlp version |
| POST | `/api/info` | `{ url }` → title, thumbnail, format choices |
| GET | `/api/download?url=…&f=<formatId>` | Streams the file as an attachment |

## Limitations on Vercel
- **No merging:** without ffmpeg, only single-file formats are offered (video with audio, or audio only). On YouTube that usually means 360p max for video, plus full-quality audio (M4A/WebM).
- **Duration:** each function can run for up to 300 s (`maxDuration`). Very large files on slow links may be cut off. The Pro plan allows up to 800 s.
- **Blocked IPs:** YouTube and Instagram often block cloud IPs ("Sign in to confirm you're not a bot"). Set `YTDLP_COOKIES` to work around this.
- **Bandwidth:** streamed bytes count toward Vercel's Fast Data Transfer usage.

For 1080p or 4K merging and MP3 conversion, host the backend on a container platform with ffmpeg (Render, Railway, Fly.io) and point the frontend at it with `VITE_API_URL`.

## Disclaimer
For personal use with content you own or have permission to download. Respect each platform's terms of service and copyright law.
