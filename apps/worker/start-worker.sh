#!/usr/bin/env bash
set -euo pipefail

# 리포 루트
cd /home/ssm-user/catarie/gavarnie

# .env를 환경변수로 export (루트 공통 + 워커 전용)
set -a
[ -f ".env.production" ] && . ".env.production"
[ -f "apps/worker/.env.production" ] && . "apps/worker/.env.production"
set +a

# 워커 실행
exec node /home/ssm-user/catarie/gavarnie/apps/worker/dist/main.js