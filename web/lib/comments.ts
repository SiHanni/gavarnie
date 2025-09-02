import { ENV } from '@/lib/env';
import { getAccessToken } from '@/lib/http';

export type CommentAuthor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
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
  // 서버에 있으면 사용, 없으면 undefined → "답글 보기"로 표기
  replyCount?: number;
};

export type CommentsPage = {
  nodes: CommentNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();

  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
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
  mediaId: string;
  parentId?: string;
  limit?: number;
  cursor?: string | null;
}) {
  const q = new URLSearchParams();
  q.set('mediaId', params.mediaId);
  if (params.parentId) q.set('parentId', params.parentId);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', params.cursor);
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

export function likeComment(commentId: string) {
  return request<{ liked: boolean; alreadyExisted: boolean }>(
    `/comments/${commentId}/like`,
    { method: 'PUT' }
  );
}

export function unlikeComment(commentId: string) {
  return request<{ liked: boolean; alreadyExisted: boolean }>(
    `/comments/${commentId}/like`,
    { method: 'DELETE' }
  );
}

export function countCommentLikes(commentId: string) {
  return request<{ count: number }>(`/comments/${commentId}/likes`, {
    method: 'GET',
  });
}
