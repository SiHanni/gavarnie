import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecentAuthorDto {
  @ApiProperty({ example: '16' })
  id!: string;

  @ApiProperty({ example: '르클레르' })
  displayName!: string;

  @ApiProperty({ example: 'https://.../avatar.png', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'iammingki' })
  handle!: string;
}
export class RecentQueryDto {
  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiProperty({
    required: false,
    description: '커서(Base64) - 서버가 준 endCursor 그대로 넘기세요',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class RecentMediaNode {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  hlsKey!: string;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty({ required: false, type: Number, nullable: true })
  size?: number | null;

  @ApiProperty()
  createdAt!: string; // ISO 문자열

  @ApiProperty({ type: RecentAuthorDto })
  author!: RecentAuthorDto;

  @ApiProperty({ example: 42, description: 'isActive=1 기준 좋아요 수' })
  likeCount!: number;

  @ApiProperty({ example: 7, description: '삭제되지 않은 댓글/대댓글 개수' })
  commentCount!: number;

  @ApiProperty({
    required: false,
    example: true,
    description: '로그인 사용자인 경우, 내가 좋아요 눌렀는지',
  })
  likedByMe?: boolean;
}

export class RecentPageInfo {
  @ApiProperty({ nullable: true })
  endCursor!: string | null;
  @ApiProperty()
  hasNextPage!: boolean;
}

export class RecentResponseDto {
  @ApiProperty({ type: [RecentMediaNode] })
  nodes!: RecentMediaNode[];
  @ApiProperty({ type: RecentPageInfo })
  pageInfo!: RecentPageInfo;
}
