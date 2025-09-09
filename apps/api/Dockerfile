# syntax=docker/dockerfile:1.7

# ── Prod deps only (Yarn v4) ───────────────────────────────────────────
FROM node:20-alpine AS proddeps
WORKDIR /app
# Yarn v4 준비 (레포에 .yarn 없어도 OK)
RUN corepack enable && corepack prepare yarn@4.9.3 --activate
# 워크스페이스 메타(패키지 매니페스트)만 복사 후 프로덕션 의존성만 설치
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
RUN yarn workspaces focus --all --production && yarn cache clean

# ── Runtime ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# 프로덕션 의존성만 복사
COPY --from=proddeps /app/node_modules ./node_modules
# ✅ GitHub Actions에서 미리 만든 dist를 그대로 복사
COPY apps/api/dist ./apps/api/dist
COPY libs/entities/dist ./libs/entities/dist
COPY libs/logging/dist ./libs/logging/dist
COPY libs/migrations/dist ./libs/migrations/dist
EXPOSE 3000
CMD ["node","apps/api/dist/main.js"]
