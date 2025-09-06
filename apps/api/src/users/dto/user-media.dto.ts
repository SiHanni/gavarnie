import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UserMediaQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '커서(Base64)' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class UserMediaAuthorDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  displayName!: string;
  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}

export class UserMediaNodeDto {
  @ApiProperty()
  id!: string; // media.id
  @ApiProperty()
  hlsKey!: string;
  @ApiProperty()
  originalFilename!: string;
  @ApiProperty()
  title!: string;
  @ApiProperty()
  contentType!: string;
  @ApiProperty({ nullable: true })
  size!: number | null;
  @ApiProperty()
  createdAt!: string;
  @ApiProperty({ type: UserMediaAuthorDto })
  author!: UserMediaAuthorDto;
  @ApiProperty()
  likeCount!: number;
  @ApiProperty()
  commentCount!: number;
  @ApiProperty({ nullable: true })
  thumbnailKey!: string | null;
  @ApiProperty({ nullable: true })
  thumbnailWidth!: number | null;
  @ApiProperty({ nullable: true })
  thumbnailHeight!: number | null;
  @ApiProperty({ default: 1 })
  thumbnailVersion!: number;
}

export class PageInfoDto {
  @ApiProperty({ nullable: true })
  endCursor!: string | null;
  @ApiProperty()
  hasNextPage!: boolean;
}

export class UserMediaResponseDto {
  @ApiProperty({ type: [UserMediaNodeDto] })
  nodes!: UserMediaNodeDto[];
  @ApiProperty({ type: PageInfoDto })
  pageInfo!: PageInfoDto;
}
