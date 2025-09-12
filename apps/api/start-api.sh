#!/usr/bin/env bash
set -euo pipefail

# 리포 루트로 이동
cd /home/ssm-user/catarie/gavarnie

# .env들을 환경변수로 export
set -a
[ -f ".env.production" ] && . ".env.production"
[ -f "apps/api/.env.production" ] && . "apps/api/.env.production"
set +a

# API 실행
exec node /home/ssm-user/catarie/gavarnie/apps/api/dist/main.js