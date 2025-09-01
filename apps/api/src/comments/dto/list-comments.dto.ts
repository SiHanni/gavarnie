import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListCommentsQueryDto {
  @ApiProperty({ description: 'Media UUID' })
  @IsUUID('4')
  mediaId!: string;

  @ApiPropertyOptional({
    description: '부모 댓글 id',
    example: '12345',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor (Base64). 서버에서 제공하는 endCursor값 사용',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
