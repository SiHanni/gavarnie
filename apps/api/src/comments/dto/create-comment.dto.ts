import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsNumberString,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Media UUID' })
  @IsUUID('4')
  mediaId!: string;

  @ApiPropertyOptional({
    description: '대댓글의 경우 부모 댓글 id',
    example: '12345',
  })
  @IsOptional()
  @IsNumberString()
  parentId?: string;

  @ApiProperty({ description: 'Comment text' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}
