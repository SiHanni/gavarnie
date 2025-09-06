import { ENV } from '@/lib/env';
import { getAccessToken } from '@/lib/http';

export type CommentAuthor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  handle: string; // ← 추가: 프로필 링크 /@handle (at 20250907)
};

export type CommentNode = {
  id: string;
  parentId: string | null;
  depth: 0 | 1;
  text: string;
  isDeleted: boolean;
  createdAt: string;
  author: CommentAuthor;
  likeCount: number;
  replyCount?: number; // 서버에서 주면 표시
  likedByMe?: boolean; // ← 선택 필드: 로그인 시 포함
};

export type CommentsPage = {
  nodes: CommentNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();

  if (!(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${ENV.API}${path}`, {
    ...init,
    headers,
    credentials: 'omit',
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json')
    ? ((await res.json()) as T)
    : (undefined as T);
}

export function listComments(params: {
  mediaId: string; // uuid v4
  parentId?: string;
  limit?: number;
  cursor?: string | null;
}) {
  const q = new URLSearchParams();
  q.set('mediaId', params.mediaId);
  if (params.parentId) q.set('parentId', params.parentId);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', params.cursor!);
  return request<CommentsPage>(`/comments?${q.toString()}`);
}

export function createComment(body: {
  mediaId: string;
  text: string;
  parentId?: string;
}) {
  return request<CommentNode>('/comments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteComment(commentId: string) {
  return request<{ ok: true }>(`/comments/${commentId}`, { method: 'DELETE' });
}

/** 서버 응답: { liked: true, likeCount: number } */
export function likeComment(commentId: string) {
  return request<{ liked: boolean; likeCount: number }>(
    `/comments/${commentId}/like`,
    { method: 'PUT' }
  );
}

/** 서버 응답: { liked: false, likeCount: number } */
export function unlikeComment(commentId: string) {
  return request<{ liked: boolean; likeCount: number }>(
    `/comments/${commentId}/like`,
    { method: 'DELETE' }
  );
}

/** 서버 응답: { likeCount: number } */
export function countCommentLikes(commentId: string) {
  return request<{ likeCount: number }>(`/comments/${commentId}/likes`, {
    method: 'GET',
  });
}
