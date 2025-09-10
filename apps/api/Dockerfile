# syntax=docker/dockerfile:1.7

# ── Prod deps only (Yarn v4) ───────────────────────────────────────────
FROM node:20-bookworm-slim AS proddeps
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
# Yarn v4
RUN corepack enable && corepack prepare yarn@4.9.3 --activate
COPY .yarnrc.yml ./
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
# 선택 워크스페이스만 설치 (api에 sharp, bcrypt 등 포함)
RUN yarn workspaces focus --production @catarie/api @catarie/entities @catarie/logging @catarie/migrations \
  && yarn cache clean

# ── Runtime ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# node_modules
COPY --from=proddeps /app/node_modules ./node_modules

# 빌드 산출물
COPY apps/api/dist ./apps/api/dist
COPY libs/entities/dist ./libs/entities/dist
COPY libs/logging/dist ./libs/logging/dist

# 워크스페이스 패키지를 node_modules에도 만들어 패키지 해석 보장
RUN mkdir -p node_modules/@catarie/entities node_modules/@catarie/logging
COPY libs/entities/package.json node_modules/@catarie/entities/package.json
COPY libs/entities/dist         node_modules/@catarie/entities/dist
COPY libs/logging/package.json  node_modules/@catarie/logging/package.json
COPY libs/logging/dist          node_modules/@catarie/logging/dist

# (선택) 마이그 소스 유지
COPY libs/migrations/package.json ./libs/migrations/package.json
COPY libs/migrations/src ./libs/migrations/src

EXPOSE 3000
CMD ["node","apps/api/dist/main.js"]
