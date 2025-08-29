#!/usr/bin/env bash
set -euo pipefail

# ===== 설정 =====
API_BASE="${API:-http://localhost:3000}"   # 필요하면 export API=... 로 바꿔도 됨
DL_DIR_DEFAULT="/Users/sihwanlee/Downloads"

# ===== 의존성 체크 =====
if ! command -v curl >/dev/null 2>&1; then
  echo "curl이 필요합니다." >&2; exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq가 필요합니다. (macOS: brew install jq)" >&2; exit 1
fi
if ! command -v file >/dev/null 2>&1; then
  echo "file 명령이 필요합니다." >&2; exit 1
fi

# ===== 입력값 =====
TOKEN="${1:-${TOKEN:-}}"
INPUT="${2:-}"

if [[ -z "$TOKEN" ]]; then
  read -rsp "JWT Access Token 입력: " TOKEN
  echo
fi

if [[ -z "$INPUT" ]]; then
  read -rp "업로드할 파일명(또는 전체 경로) 입력: " INPUT
fi

# 파일 경로 해석: 전체 경로가 아니면 DL_DIR_DEFAULT 밑에서 찾음
if [[ "$INPUT" = /* ]]; then
  FILE="$INPUT"
else
  FILE="${DL_DIR_DEFAULT%/}/$INPUT"
fi

if [[ ! -f "$FILE" ]]; then
  echo "파일이 없습니다: $FILE" >&2
  exit 1
fi

FILENAME="$(basename "$FILE")"

# MIME 타입 결정
CT="$(file --mime-type -b "$FILE")"
echo "파일: $FILE"
echo "추정 Content-Type: $CT"

# ===== (1) presign =====
echo "→ presign 요청 중..."
PRESIGN_JSON="$(
  curl -sS -X POST "$API_BASE/uploads/presign" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"originalFilename\":\"$FILENAME\",\"contentType\":\"$CT\"}"
)"
echo "$PRESIGN_JSON" | jq .

MEDIA_ID="$(echo "$PRESIGN_JSON" | jq -r '.mediaId')"
PUT_URL="$(echo "$PRESIGN_JSON" | jq -r '.url')"
KEY="$(echo "$PRESIGN_JSON" | jq -r '.key')"
CT_OUT="$(echo "$PRESIGN_JSON" | jq -r '.headers["Content-Type"] // empty')"

if [[ -z "$MEDIA_ID" || "$MEDIA_ID" == "null" ]]; then
  echo "presign 실패: mediaId 없음" >&2; exit 1
fi
if [[ -z "$PUT_URL" || "$PUT_URL" == "null" ]]; then
  echo "presign 실패: url 없음" >&2; exit 1
fi
if [[ -n "$CT_OUT" ]]; then
  CT="$CT_OUT"
fi
echo "MEDIA_ID=$MEDIA_ID"
echo "KEY=$KEY"
echo "PUT_URL(생략) ..."

# ===== (2) 실제 업로드 (PUT S3 Presigned URL) =====
echo "→ presigned URL로 업로드 중..."
HTTP_CODE="$(curl -sS -X PUT "$PUT_URL" \
  -H "Content-Type: $CT" \
  --upload-file "$FILE" \
  -o /dev/null -w "%{http_code}")"

echo "PUT 응답 코드: $HTTP_CODE"
if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -gt 299 ]]; then
  echo "업로드 실패 (HTTP $HTTP_CODE)" >&2
  exit 1
fi

# ===== (3) complete =====
# macOS / Linux size 계산
if stat -f%z "$FILE" >/dev/null 2>&1; then
  SIZE="$(stat -f%z "$FILE")"
else
  SIZE="$(stat -c%s "$FILE")"
fi
echo "→ complete 요청 (size=$SIZE)..."

COMPLETE_JSON="$(
  curl -sS -X POST "$API_BASE/uploads/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"mediaId\":\"$MEDIA_ID\",\"key\":\"$KEY\",\"size\":$SIZE}"
)"
echo "$COMPLETE_JSON" | jq .

STATUS="$(echo "$COMPLETE_JSON" | jq -r '.status // empty')"
echo "현재 상태: ${STATUS:-unknown}"

# ===== (4) 상태 확인 힌트 =====
cat <<EOF

다음 명령으로 상태를 확인하세요:
  curl -sS "$API_BASE/media/$MEDIA_ID/status" | jq

READY가 되면 스트림 메타:
  curl -sS "$API_BASE/media/$MEDIA_ID" | jq

EOF
