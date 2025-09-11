# ---------- Builder ----------
    FROM node:20-bookworm-slim AS builder
    WORKDIR /app
    
    RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ git ca-certificates && \
      rm -rf /var/lib/apt/lists/*
    
    RUN corepack enable
    COPY . .
    
    # 설치 + 빌드
    RUN yarn install --immutable
    RUN yarn build:api
    
    # ---------- Runtime ----------
    FROM node:20-bookworm-slim AS runtime
    WORKDIR /app
    ENV NODE_ENV=production TZ=Asia/Seoul
    
    # 런타임에서 네트워크 없이 yarn 실행 가능하도록 미리 준비
    RUN corepack enable && corepack prepare yarn@4.9.3 --activate
    
    # 레포 전체 복사(안전 우선: 실행 스크립트/워크스페이스 경로 문제 0%)
    COPY --from=builder /app /app
    
    # 로그 디렉토리
    RUN mkdir -p /app/logs && chown -R node:node /app/logs
    USER node
    
    EXPOSE 3000
    
    # 레포의 "정확한" 실행 스크립트를 그대로 사용
    CMD ["yarn", "prod:api"]
    
    # (선택) 헬스체크 추가: 30s 후부터 10초마다 /health 확인
    HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
      CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>{if(r.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"
    