import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
  contentType!: string;
  @ApiProperty({ required: false, type: Number, nullable: true })
  size?: number | null;
  @ApiProperty()
  updatedAt!: string; // ISO 문자열
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
