## Upload test script for Gavarnie

- Flow:
- 1.  POST /login → Bearer 토큰 획득
- 2.  POST /uploads/presign → PUT presigned URL, headers, key, mediaId 획득
- 3.  PUT <presigned_url> → 파일 업로드 (headers 포함)
- 4.  POST /uploads/complete → 업로드 완료 통지
- 5.  GET /uploads/media/:id/status → 상태 조회 (선택)
-
- 사용 명령어:

```
yarn workspace @gavarnie/api upload:test -- /ABS/PATH/TO/file.mp4 --email user@example.com --password secret1234 --kind video --api http://localhost:3000
```

```
예시
yarn workspace @gavarnie/api upload:test -- '/Users/sihwanlee/Downloads/f1-radio.mp3' \
  --email user@example.com \
  --password secret1234 \
  --api http://localhost:3000
```

- Requires: Node.js 18+ (global fetch). Adds dependency "mime-types".

## 내부 흐름:

- parseArgs() // CLI/ENV → { file, api, email, ... }
- mime.lookup(filename) // content-type 추론
- inferKind(filename, mime) // 'video' | 'audio' | undefined
- postJSON('/login', ...) // accessToken 획득
- postJSON('/uploads/presign', { originalFilename, contentType, kind? })
- pickPresignFields(resp) // url + headers + key + mediaId 정규화
- PUT url with headers // 실제 객체 업로드
- postJSON('/uploads/complete', { mediaId, key, size })
- getJSON('/uploads/media/:id/status')
