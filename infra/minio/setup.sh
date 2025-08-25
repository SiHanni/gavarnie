# HLS 파일을 로컬에서 곧장 재생 테스트하기 위해 media 버킷 만들고 개발용 공개 다운로드 허용
#!/bin/sh
set -e

mc alias set local http://minio:9000 minio minio123
mc mb -p local/media || true

# 개발 편의를 위해 공개 다운로드 허용(운영에선 조정)
mc anonymous set download local/media

# 컨테이너가 바로 종료되지 않도록 대기
sleep infinity
