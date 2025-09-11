# ---------- Builder ----------
    FROM node:20-bookworm-slim AS builder
    WORKDIR /app
    
    RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ git ca-certificates && \
      rm -rf /var/lib/apt/lists/*
    
    RUN corepack enable
    COPY . .
    
    RUN yarn install --immutable
    RUN yarn build:worker
    RUN yarn workspaces focus --all --production
    
    RUN bash -lc 'if [ -d dist/libs ]; then \
      for d in dist/libs/*; do n=$(basename "$d"); \
        mkdir -p libs/$n/dist && cp -r dist/libs/$n/* libs/$n/dist/; \
      done; fi'
    
    # ---------- Runtime ----------
    FROM node:20-bookworm-slim AS runtime
    WORKDIR /app
    ENV NODE_ENV=production TZ=Asia/Seoul
    
    COPY --from=builder /app/package.json ./package.json
    COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/libs ./libs
    COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
    
    # ffmpeg가 필요하면 아래 주석 해제
    # RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
    
    USER node
    CMD ["node", "apps/worker/dist/main.js"]
    