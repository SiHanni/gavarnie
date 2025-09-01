/**
 * Upload test script for Catarie
 * Flow:
 * 1) POST /login  → Bearer 토큰 획득
 * 2) POST /uploads/presign  → PUT presigned URL, headers, key, mediaId 획득
 * 3) PUT <presigned_url>  → 파일 업로드 (headers 포함)
 * 4) POST /uploads/complete  → 업로드 완료 통지
 * 5) GET /uploads/media/:id/status  → 상태 조회 (선택)
 *
 * Usage:
 *  yarn workspace @gavarnie/api upload:test -- /ABS/PATH/TO/file.mp4 --email user@example.com --password secret1234 --kind video --api http://localhost:3000
 *
 * Requires: Node.js 18+ (global fetch). Adds dependency "mime-types".
 *
 * # 내부 흐름:
 * parseArgs()                 // CLI/ENV → { file, api, email, ... }
 * mime.lookup(filename)       // content-type 추론
 * inferKind(filename, mime)   // 'video' | 'audio' | undefined
 * postJSON('/login', ...)     // accessToken 획득
 * postJSON('/uploads/presign', { originalFilename, contentType, kind? })
 * pickPresignFields(resp)     // url + headers + key + mediaId 정규화
 * PUT url with headers        // 실제 객체 업로드
 * postJSON('/uploads/complete', { mediaId, key, size })
 * getJSON('/uploads/media/:id/status')
 */

import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import mime from 'mime-types';

type Kind = 'video' | 'audio';
type LoginResponse = { accessToken: string };
type PresignResponse = {
  url?: string;
  putUrl?: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  signedHeaders?: Record<string, string>;
  putHeaders?: Record<string, string>;
  key?: string; // e.g. original/<uuid>.mp4
  objectKey?: string;
  srcKey?: string;
  uploadKey?: string;
  mediaId?: string; // uuid
  id?: string;
  media?: { id?: string };
};

const DEFAULT_API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

/**
 * CLI 인자를 파싱해서 파일 경로/이메일/비밀번호/API베이스/미디어 종류 추출
 * process.argv.slice(2) (스크립트 뒤에 작성한 인자들)
 * - -- /ABS/PATH/TO/file.mp4
 * - --email user@example.com
 * - --password secret1234
 * - --kind video
 * - --api http://localhost:3000
 *
 * @returns
 */
function parseArgs() {
  const argv = process.argv.slice(2);
  const out: Record<string, string> = {};

  const fileArgIdx = argv.findIndex((a) => !a.startsWith('-'));
  if (fileArgIdx >= 0) out.file = argv[fileArgIdx];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('-')) continue;
    const key = a.replace(/^--?/, '');
    const val =
      argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : 'true';
    out[key] = val;
    if (val !== 'true') i++;
  }

  out.api = out.api ?? process.env.API_BASE ?? DEFAULT_API_BASE;
  out.email = out.email ?? process.env.EMAIL ?? '';
  out.password = out.password ?? process.env.PASSWORD ?? '';
  out.kind = out.kind ?? process.env.KIND ?? '';

  return out as {
    file?: string;
    api: string;
    email: string;
    password: string;
    kind?: string;
  };
}

/**
 * 파일명/콘텐츠 타입을 기반으로 미디어 종류(video/audio) 추론
 * @param filename
 * @param contentType
 * @returns
 */
function inferKind(
  filename: string,
  contentType: string | false,
): Kind | undefined {
  const ext = path.extname(filename).toLowerCase();
  const videoExt = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
  const audioExt = new Set([
    '.mp3',
    '.aac',
    '.m4a',
    '.wav',
    '.flac',
    '.ogg',
    '.oga',
    '.opus',
  ]);

  if (videoExt.has(ext)) return 'video';
  if (audioExt.has(ext)) return 'audio';
  if (typeof contentType === 'string') {
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
  }
  return undefined; // optional
}

/**
 * JSON POST 표준화
 * @param url
 * @param body
 * @param headers
 * @returns
 */
async function postJSON<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[POST ${url}] ${res.status} ${res.statusText} – ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 *
 * @param url
 * @param headers
 * @returns
 */
async function getJSON<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`[GET ${url}] ${res.status} ${res.statusText} – ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * 서버의 presign 응답의 키 이름이 다를수 있을 가능성에 필요한 값들을 정규화
 * @param d
 * @returns
 */
function pickPresignFields(d: PresignResponse) {
  const url = d.url ?? d.putUrl ?? d.uploadUrl;
  const headers = d.headers ?? d.signedHeaders ?? d.putHeaders ?? {};
  const key = d.key ?? d.objectKey ?? d.srcKey ?? d.uploadKey;
  const mediaId = d.mediaId ?? d.id ?? d.media?.id;
  return { url, headers, key, mediaId };
}

async function main() {
  const args = parseArgs();

  // 0) inputs 값 검증
  if (!args.file) {
    console.error(
      '❌ Usage: upload-test -- /ABS/PATH/TO/file.mp4 --email <email> --password <pw> [--kind video|audio] [--api http://localhost:3000]',
    );
    process.exit(1);
  }
  const absPath = args.file;
  if (!path.isAbsolute(absPath)) {
    console.error('❌ Please provide an ABSOLUTE file path.');
    process.exit(1);
  }
  const st = await stat(absPath).catch(() => null);
  if (!st || !st.isFile()) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }
  if (!args.email || !args.password) {
    console.error(
      '❌ Please provide credentials: --email <email> --password <pw> (or set EMAIL/PASSWORD env)',
    );
    process.exit(1);
  }

  const filename = path.basename(absPath);
  const contentType = mime.lookup(filename) || 'application/octet-stream';
  const kindArg = (args.kind || '').toLowerCase();
  const kind =
    kindArg === 'video' || kindArg === 'audio'
      ? (kindArg as Kind)
      : inferKind(filename, contentType);

  console.log('— Upload test starting —');
  console.log('API        :', args.api);
  console.log('File       :', absPath);
  console.log('Filename   :', filename);
  console.log('ContentType:', contentType);
  console.log('Kind       :', kind ?? '(omitted)');

  // 1) login
  const loginUrl = `${args.api}/auth/login`;
  const loginResp = await postJSON<LoginResponse>(loginUrl, {
    email: args.email,
    password: args.password,
  }).catch((e) => {
    console.error('❌ Login failed:', e.message);
    process.exit(1);
  });
  console.log('LOGIN RESPONSE ::', loginResp);
  const accessToken = loginResp.accessToken;
  if (!accessToken) {
    console.error('❌ No accessToken in /login response');
    process.exit(1);
  }
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  console.log('✅ Login OK');

  // 2) presign
  const presignUrl = `${args.api}/uploads/presign`;
  const presignBody: Record<string, unknown> = {
    originalFilename: filename,
    contentType,
  };
  if (kind) presignBody.kind = kind;

  const presign = await postJSON<PresignResponse>(
    presignUrl,
    presignBody,
    authHeader,
  ).catch((e) => {
    console.error('❌ Presign failed:', e.message);
    process.exit(1);
  });
  const {
    url: putUrl,
    headers: putHeaders,
    key,
    mediaId,
  } = pickPresignFields(presign);
  if (!putUrl || !key || !mediaId) {
    console.error(
      '❌ Presign response missing required fields. Need url + key + mediaId.\nResponse:',
      presign,
    );
    process.exit(1);
  }
  console.log('✅ Presign OK');
  // console.debug('DEBUG presign:', { putUrl, putHeaders, key, mediaId });

  // 3) upload (PUT)
  const buf = await readFile(absPath);

  // Buffer → Uint8Array(ArrayBuffer)로 복사 (타입 호환 100%)
  const bytes = new Uint8Array(buf.length);
  bytes.set(buf);

  const uploadHeaders: Record<string, string> = {
    'Content-Type': String(contentType),
    'Content-Length': String(bytes.byteLength), // presign 정책상 필요하면 유지
    ...putHeaders,
  };

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    body: bytes, // ← Uint8Array는 BodyInit에 정확히 들어맞음
    headers: uploadHeaders,
  }).catch((e) => {
    console.error('❌ Upload request failed:', e.message);
    process.exit(1);
  });

  if (!putRes.ok) {
    const t = await putRes.text();
    console.error(
      `❌ Upload failed: ${putRes.status} ${putRes.statusText}\n${t}`,
    );
    process.exit(1);
  }
  console.log('✅ Upload OK');

  // 4) complete
  const completeUrl = `${args.api}/uploads/complete`;
  const completeResp = await postJSON<Record<string, unknown>>(
    completeUrl,
    {
      mediaId,
      key,
      size: st.size,
    },
    authHeader,
  ).catch((e) => {
    console.error('❌ Complete failed:', e.message);
    process.exit(1);
  });
  console.log('✅ Complete OK:', completeResp);

  // 5) status (optional)
  const statusUrl = `${args.api}/uploads/media/${mediaId}/status`;
  try {
    const status = await getJSON<Record<string, unknown>>(statusUrl);
    console.log('ℹ️ Status:', status);
  } catch (e: any) {
    console.warn('⚠️ Status fetch failed (non-blocking):', e.message);
  }

  console.log('— All done —');
}

main().catch((e) => {
  console.error('❌ Uncaught error:', e);
  process.exit(1);
});
