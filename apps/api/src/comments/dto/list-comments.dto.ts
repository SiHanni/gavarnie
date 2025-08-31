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
  @ApiProperty({ description: 'Media UUID (media.id)' })
  @IsUUID('4')
  mediaId!: string;

  @ApiPropertyOptional({
    description: 'Parent comment id (omit for root list)',
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
    description: 'Cursor (Base64). Use the server-provided endCursor as-is.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
