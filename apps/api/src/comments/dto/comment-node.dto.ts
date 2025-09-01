// apps/api/src/comments/dto/comment-node.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ example: '16' })
  id!: string;

  @ApiProperty({ example: '르클레르' })
  displayName!: string;

  @ApiProperty({ example: 'https://.../avatar.png', nullable: true })
  avatarUrl!: string | null;
}

export class CommentNodeDto {
  @ApiProperty({ example: '101' })
  id!: string;

  @ApiProperty({ nullable: true, example: null })
  parentId!: string | null;

  @ApiProperty({ example: 0, description: '0=댓글, 1=대댓글' })
  depth!: number;

  @ApiProperty({ example: '댓글 본문. 삭제 시 빈 문자열' })
  text!: string;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiProperty({ example: '2025-09-02T02:20:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: CommentAuthorDto })
  author!: CommentAuthorDto;

  @ApiProperty({ example: 12, description: 'isActive=1 기준 좋아요 수' })
  likeCount!: number;

  @ApiProperty({
    required: false,
    description: '로그인 사용자인 경우에만 포함',
    example: true,
  })
  likedByMe?: boolean;
}

export class PageInfoDto {
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty({ nullable: true }) endCursor!: string | null;
}

export class ListCommentsResponseDto {
  @ApiProperty({ type: [CommentNodeDto] })
  nodes!: CommentNodeDto[];

  @ApiProperty({ type: PageInfoDto })
  pageInfo!: PageInfoDto;
}
