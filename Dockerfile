# Full backend (Render / any Docker host): yt-dlp + ffmpeg → merging, 4K, MP3.
# Also serves the built React app, so one service can host everything.

FROM node:22-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# Leave VITE_API_URL empty: frontend and API share the same origin
RUN npm run build

FROM node:22-slim
# Pin with: docker build --build-arg YTDLP_VERSION=2026.10.26 .  (empty = latest)
ARG YTDLP_VERSION=
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]${YTDLP_VERSION:+==$YTDLP_VERSION}" \
 && apt-get purge -y python3-pip && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist

RUN mkdir -p downloads && chown -R node:node /app
USER node

EXPOSE 10000
ENV PORT=10000
HEALTHCHECK --interval=30s --timeout=10s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
