# syntax=docker/dockerfile:1.7

# ---------- base ----------
    FROM node:20-alpine AS base
    WORKDIR /repo
    # Yarn v4 고정 (레포에 .yarn 없어도 동작)
    RUN corepack enable && corepack prepare yarn@4.9.3 --activate
    
    # ---------- deps (install with immutable) ----------
    FROM base AS deps
    WORKDIR /repo
    COPY .yarnrc.yml ./
    # 루트와 모든 워크스페이스의 package.json + lock만 먼저 복사 (캐시)
    COPY package.json yarn.lock ./
    COPY apps/api/package.json apps/api/
    COPY apps/worker/package.json apps/worker/
    COPY libs/entities/package.json libs/entities/
    COPY libs/logging/package.json libs/logging/
    COPY libs/migrations/package.json libs/migrations/
    # ← web도 워크스페이스이므로 포함
    COPY web/package.json web/            
    # Yarn v4: --frozen-lockfile 대신 --immutable (필요시 빌드내 native 모듈용 --inline-builds)
    RUN yarn install --immutable --inline-builds && yarn cache clean
    
    # ---------- build ----------
    FROM deps AS build
    WORKDIR /repo
    COPY . .

    # libs → api 순서로 컴파일(outDir=dist 가정)
    RUN npx tsc -b \
      libs/entities/tsconfig.json \
      libs/logging/tsconfig.json \
      libs/migrations/tsconfig.json \
      apps/api/tsconfig.build.json

    # ---------- proddeps (production only) ----------
    FROM base AS proddeps
    WORKDIR /repo
    COPY .yarnrc.yml ./
    COPY package.json yarn.lock ./
    COPY apps/api/package.json apps/api/
    COPY libs/entities/package.json libs/entities/
    COPY libs/logging/package.json libs/logging/
    COPY libs/migrations/package.json libs/migrations/
    # 프로덕션 의존성만 포커스 (node-modules 링크 방식 가정)
    RUN yarn workspaces focus --all --production && yarn cache clean
    
    # ---------- runtime ----------
    FROM node:20-alpine AS runtime
    WORKDIR /app
    ENV NODE_ENV=production
    # 프로덕션 node_modules만
    COPY --from=proddeps /repo/node_modules ./node_modules
    # 실행 산출물
    COPY --from=build /repo/apps/api/dist ./apps/api/dist
    COPY --from=build /repo/libs/entities/dist ./libs/entities/dist
    COPY --from=build /repo/libs/logging/dist ./libs/logging/dist
    COPY --from=build /repo/libs/migrations/dist ./libs/migrations/dist
    EXPOSE 3000
    CMD ["node","apps/api/dist/main.js"]
    