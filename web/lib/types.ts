export type MediaStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface AuthorLite {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RecentMediaNode {
  id: string; // 미디어 UUID
  hlsKey: string; // "hls/<uuid>/index.m3u8"
  originalFilename: string; // "#f1 실제속도 #shorts.mp4"
  title: string;
  contentType: string; // "application/mp4" 등
  size?: number | null;
  createdAt: string; // ISO
  author: AuthorLite; // 작성자 정보
  likeCount: number; // 좋아요 수
  commentCount: number; // 댓글 수
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface RecentResponse {
  nodes: RecentMediaNode[];
  pageInfo: PageInfo;
}
