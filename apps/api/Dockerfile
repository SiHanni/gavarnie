# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
# Yarn v1 고정 (Node 20은 corepack 기본)
RUN corepack enable && corepack prepare yarn@1.22.19 --activate

# ---------- deps (캐시 최적화: 매니페스트만 복사) ----------
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/   
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
# 워크스페이스 전체 설치 (devDeps 포함: 빌드용)
RUN yarn install --frozen-lockfile

# ---------- build (전체 소스 복사 후 빌드) ----------
FROM deps AS build
COPY . .
# 전역 빌드: 각 워크스페이스가 build 스크립트를 가진다고 가정
# (libs/* → apps/api 순으로 빌드되도록 package.json의 dependencies에 연결되어 있어야 함)
RUN yarn workspaces run build || true
# 혹시 위가 비어있다면 개별 빌드(주석 해제)
# RUN yarn --cwd libs/entities build && yarn --cwd libs/logging build && yarn --cwd apps/api build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# (간단 시작) 빌드 의존성까지 포함한 node_modules 사용
COPY --from=deps /app/node_modules ./node_modules
# 실행 산출물만 복사
COPY --from=build /app/apps/api/dist ./apps/api/dist
# lib dist가 런타임에서 상대경로로 참조된다면 함께 복사
COPY --from=build /app/libs/entities/dist ./libs/entities/dist
COPY --from=build /app/libs/logging/dist ./libs/logging/dist
# (필요 시) 마이그레이션/스크립트가 런타임에 필요하면 복사
# COPY --from=build /app/libs/migrations/dist ./libs/migrations/dist
# 포트는 Nest 기본 3000
EXPOSE 3000
CMD ["node","apps/api/dist/main.js"]
