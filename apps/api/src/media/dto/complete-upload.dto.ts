import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CompleteUploadDto {
  @ApiProperty({ example: 'db24481c-add2-4ce1-8686-faf87997d404' })
  @IsUUID('4')
  mediaId!: string;

  @ApiProperty({ example: 'original/db24481c-add2-4ce1-8686-faf87997d404' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({
    required: false,
    description: '클라이언트 참고용(서버는 HEAD로 검증)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size?: number;
}
