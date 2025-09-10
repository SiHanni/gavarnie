# ---------- Builder ----------
    FROM node:20-bookworm AS builder
    WORKDIR /app
    
    # 네이티브 모듈(예: sharp) 대비
    RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
      && rm -rf /var/lib/apt/lists/*
    
    # Yarn v4
    RUN corepack enable && corepack prepare yarn@4.9.3 --activate
    
    # 루트 메타/TS 설정
    COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.base.json ./
    
    # web 제외: 필요한 워크스페이스 manifest만 복사
    COPY apps/api/package.json apps/api/package.json
    COPY apps/worker/package.json apps/worker/package.json
    COPY libs/entities/package.json libs/entities/package.json
    COPY libs/logging/package.json libs/logging/package.json
    COPY libs/migrations/package.json libs/migrations/package.json
    
    # ❗ web 누락으로 인한 install 실패 방지: focus로 필요한 트리만 설치
    # (dev 포함: migrate 수행 시 tsx 등 devDeps 필요)
    RUN yarn workspaces focus @catarie/api @catarie/worker --all
    
    # 실제 소스 반입 (web 제외)
    COPY apps/api ./apps/api
    COPY apps/worker ./apps/worker
    COPY libs/entities ./libs/entities
    COPY libs/logging ./libs/logging
    COPY libs/migrations ./libs/migrations
    
    # 라이브러리 → 앱 순서로 빌드
    RUN yarn workspace @catarie/entities build \
     && yarn workspace @catarie/logging build \
     && yarn workspace @catarie/api build \
     && yarn workspace @catarie/worker build
    
    # ---------- Runtime ----------
    FROM node:20-bookworm AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    
    # 런타임에서도 yarn 사용 보장(마이그 전용 커맨드에 필요)
    RUN corepack enable && corepack prepare yarn@4.9.3 --activate
    
    # 빌더 산출물(node_modules 포함) 복사
    COPY --from=builder /app /app
    
    # 진입 스크립트
    COPY <<'EOS' /entrypoint.sh
    #!/usr/bin/env bash
    set -euo pipefail
    
    case "${SERVICE:-api}" in
      api)
        exec node apps/api/dist/main.js
        ;;
      worker)
        exec node apps/worker/dist/main.js
        ;;
      migrate)
        # DB 접속 ENV가 필요합니다.
        exec yarn workspace @catarie/migrations migrate:run
        ;;
      *)
        echo "Unknown SERVICE: ${SERVICE:-} (expected: api | worker | migrate)" >&2
        exit 1
        ;;
    esac
    EOS
    
    RUN chmod +x /entrypoint.sh
    
    # API만 3000 사용 (worker/migrate는 포트 노출 불필요)
    EXPOSE 3000
    ENV SERVICE=api
    CMD ["/entrypoint.sh"]
    