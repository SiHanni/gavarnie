#!/usr/bin/env bash
set -euo pipefail

# ===============================
# gavarnie local E2E test script
# Steps: presign -> PUT upload -> complete -> poll /media/:id
# Usage:
#   ./gavarnie_test_local.sh /absolute/path/to/file [content-type]
# Env overrides:
#   API_BASE (default: http://localhost:3000)
# ===============================

API_BASE="${API_BASE:-http://localhost:3000}"

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required. Install jq and re-run." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 /absolute/path/to/file [content-type]" >&2
  exit 1
fi

FILE_PATH="$1"
if [ ! -f "$FILE_PATH" ]; then
  echo "ERROR: file not found: $FILE_PATH" >&2
  exit 1
fi

ORIGINAL_FILENAME="$(basename -- "$FILE_PATH")"

# Detect content type if not provided
if [ $# -ge 2 ]; then
  CONTENT_TYPE="$2"
else
  if command -v file >/dev/null 2>&1; then
    CONTENT_TYPE="$(file -b --mime-type "$FILE_PATH" || echo application/octet-stream)"
  else
    case "$ORIGINAL_FILENAME" in
      *.mp3) CONTENT_TYPE="audio/mpeg" ;;
      *.mp4) CONTENT_TYPE="video/mp4" ;;
      *.aac) CONTENT_TYPE="audio/aac" ;;
      *)     CONTENT_TYPE="application/octet-stream" ;;
    esac
  fi
fi

echo "==> API_BASE: $API_BASE"
echo "==> FILE: $FILE_PATH"
echo "==> FILENAME: $ORIGINAL_FILENAME"
echo "==> CONTENT_TYPE: $CONTENT_TYPE"
echo

TMP_PRESIGN="$(mktemp)"
# 1) Presign
echo "==> 1) Requesting presign URL ..."
curl -sS -X POST "$API_BASE/uploads/presign" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg fn "$ORIGINAL_FILENAME" --arg ct "$CONTENT_TYPE" '{originalFilename:$fn, contentType:$ct}')" \
  | tee "$TMP_PRESIGN" >/dev/null

SIGNED_URL="$(jq -r '.url' < "$TMP_PRESIGN")"
MEDIA_ID="$(jq -r '.mediaId' < "$TMP_PRESIGN")"
SRC_KEY="$(jq -r '.key' < "$TMP_PRESIGN")"

if [ -z "$SIGNED_URL" ] || [ "$SIGNED_URL" = "null" ]; then
  echo "ERROR: Failed to get presign URL. Response:" >&2
  cat "$TMP_PRESIGN" >&2
  exit 1
fi

echo "    mediaId: $MEDIA_ID"
echo "    srcKey : $SRC_KEY"
echo "    signed : ${SIGNED_URL%%\?*} (query omitted)"
echo

# 2) PUT upload
echo "==> 2) Uploading file to presigned URL ..."
curl -sS -i -X PUT "$SIGNED_URL" \
  -H "Content-Type: $CONTENT_TYPE" \
  --upload-file "$FILE_PATH" \
  | awk 'NR<=1 || /^[A-Za-z-]+:/{print}'
echo

# 3) Complete
echo "==> 3) Notifying complete (queue transcode job) ..."
COMPLETE_JSON="$(jq -n --arg mid "$MEDIA_ID" --arg key "$SRC_KEY" '{mediaId:$mid, key:$key}')"
curl -sS -X POST "$API_BASE/uploads/complete" \
  -H 'Content-Type: application/json' \
  -d "$COMPLETE_JSON" | tee /dev/stderr
echo

# 4) Poll /media/:id until READY (max ~2 min)
echo "==> 4) Polling /media/$MEDIA_ID until READY ..."
ATTEMPTS=60
SLEEP=2
STREAM_URL=""
for (( i=1; i<=ATTEMPTS; i++ )); do
  HTTP_CODE="$(curl -sS -o /tmp/media_resp.json -w '%{http_code}' "$API_BASE/media/$MEDIA_ID" || true)"
  if [ "$HTTP_CODE" = "200" ]; then
    STATUS="$(jq -r '.status' /tmp/media_resp.json)"
    if [ "$STATUS" = "READY" ]; then
      STREAM_URL="$(jq -r '.streamUrl' /tmp/media_resp.json)"
      echo "    READY! streamUrl: $STREAM_URL"
      break
    fi
  elif [ "$HTTP_CODE" = "409" ]; then
    echo "    Not ready yet (409). Waiting ... ($i/$ATTEMPTS)"
  elif [ "$HTTP_CODE" = "404" ]; then
    echo "    Media not found (404). Check mediaId. Aborting." >&2
    exit 1
  else
    echo "    HTTP $HTTP_CODE from /media/$MEDIA_ID:" >&2
    cat /tmp/media_resp.json >&2
  fi
  sleep "$SLEEP"
done

if [ -z "$STREAM_URL" ]; then
  echo "ERROR: Timed out waiting for READY. Check worker logs." >&2
  exit 1
fi

echo
echo "==> SUCCESS"
echo "    MEDIA_ID : $MEDIA_ID"
echo "    STREAM_URL: $STREAM_URL"
echo
echo "Open this URL in Safari, or paste into an hls.js demo:"
echo "  $STREAM_URL"
