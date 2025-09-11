# apps/api/Dockerfile

# ---------- Builder ----------
    FROM node:20-bookworm-slim AS builder
    WORKDIR /app
    
    RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ git ca-certificates && \
      rm -rf /var/lib/apt/lists/*
    
    RUN corepack enable
    COPY . .
    
    # 1) 의존성 설치 + 2) API 빌드
    RUN yarn install --immutable
    RUN yarn build:api
    
    # 3) 프로덕션 의존성만 유지
    RUN yarn workspaces focus --all --production
    
    # 4) 📦 라이브러리 배치 보정:
    #    dist/libs/<name>/...  →  libs/<name>/dist/...
    #    (워크스페이스 패키지들이 main: "dist/..." 를 바라볼 때 런타임에서도 파일이 존재하도록)
    RUN bash -lc 'if [ -d dist/libs ]; then \
      for d in dist/libs/*; do \
        n=$(basename "$d"); \
        mkdir -p libs/$n/dist && cp -r dist/libs/$n/* libs/$n/dist/; \
      done; \
    fi'
    
    # ---------- Runtime ----------
    FROM node:20-bookworm-slim AS runtime
    WORKDIR /app
    ENV NODE_ENV=production TZ=Asia/Seoul
    
    # 런타임에 필요한 최소파일
    COPY --from=builder /app/package.json ./package.json
    COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
    
    # 프로덕션 node_modules
    COPY --from=builder /app/node_modules ./node_modules
    
    # ✅ libs 워크스페이스(빌드 산출물 포함) 복사
    COPY --from=builder /app/libs ./libs
    
    # 앱 빌드 산출물
    COPY --from=builder /app/apps/api/dist ./apps/api/dist
    
    USER node
    EXPOSE 3000
    CMD ["node", "apps/api/dist/main.js"]
    