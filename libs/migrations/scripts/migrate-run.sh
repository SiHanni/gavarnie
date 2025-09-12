#!/usr/bin/env bash
set -euo pipefail

# 스크립트 기준으로 리포 루트 계산: libs/migrations/scripts -> ../../..
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

# .env 주입(루트 + API 전용이 있으면 함께)
set -a
[ -f "$REPO_ROOT/.env.production" ] && . "$REPO_ROOT/.env.production"
[ -f "$REPO_ROOT/apps/api/.env.production" ] && . "$REPO_ROOT/apps/api/.env.production"
set +a

# 저자원 설치: build 스크립트 실행 생략 (⚠️ 단수: skip-build)
yarn install --mode=skip-build

# 마이그 전용 워크스페이스만 포커스(프로덕션 의존성 위주)
yarn workspaces focus @catarie/migrations -A --production

# 실제 마이그레이션 실행
yarn workspace @catarie/migrations migrate:run