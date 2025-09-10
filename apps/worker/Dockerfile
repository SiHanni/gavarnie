# syntax=docker/dockerfile:1.7

# ── Prod deps only (Yarn v4) ───────────────────────────────────────────
FROM node:20-bookworm-slim AS proddeps
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare yarn@4.9.3 --activate
COPY .yarnrc.yml ./
COPY package.json yarn.lock ./
COPY apps/worker/package.json apps/worker/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
RUN yarn workspaces focus --all --production && yarn cache clean

# ── Runtime ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# ffmpeg (필요 시 시스템 패키지로 설치하거나, 기존처럼 컨테이너에 내장)
RUN apt-get update && apt-get install -y ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=proddeps /app/node_modules ./node_modules
COPY apps/worker/dist ./apps/worker/dist
COPY libs/entities/dist ./libs/entities/dist
COPY libs/logging/dist ./libs/logging/dist

RUN mkdir -p node_modules/@catarie/entities node_modules/@catarie/logging
COPY libs/entities/package.json node_modules/@catarie/entities/package.json
COPY libs/entities/dist         node_modules/@catarie/entities/dist
COPY libs/logging/package.json  node_modules/@catarie/logging/package.json
COPY libs/logging/dist          node_modules/@catarie/logging/dist

EXPOSE 3001
CMD ["node","apps/worker/dist/main.js"]
