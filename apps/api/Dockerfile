# syntax=docker/dockerfile:1.7

# ── Prod deps only (Yarn v4) ───────────────────────────────────────────
FROM node:20-alpine AS proddeps
WORKDIR /app
# Yarn v4 고정
RUN apk add --no-cache ca-certificates && corepack enable && corepack prepare yarn@4.9.3 --activate
# Yarn 설정(노드모듈 모드) 반영
COPY .yarnrc.yml ./
# 루트/필요 워크스페이스 매니페스트만 복사
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
# 프로덕션 의존성만 (필요 워크스페이스로 좁혀서 슬림화)
RUN yarn workspaces focus --production @catarie/api @catarie/entities @catarie/logging @catarie/migrations \
  && yarn cache clean

# ── Runtime ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# (선택) 루트 CA 확실히
RUN apk add --no-cache ca-certificates

# 프로덕션 의존성
COPY --from=proddeps /app/node_modules ./node_modules

# 앱/라이브러리 실행 산출물 (Actions에서 미리 build된 dist)
COPY apps/api/dist ./apps/api/dist
COPY libs/entities/dist ./libs/entities/dist
COPY libs/logging/dist ./libs/logging/dist

# ✅ 마이그레이션은 tsx로 TS 소스를 직접 실행 → src만 포함
COPY libs/migrations/package.json ./libs/migrations/package.json
COPY libs/migrations/src ./libs/migrations/src

EXPOSE 3000
# (선택 보안) 비루트 실행 원하면 아래 두 줄 추가
# RUN adduser -D -g '' appuser && chown -R appuser:appuser /app
# USER appuser

CMD ["node","apps/api/dist/main.js"]
