import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteUploadDto {
  @ApiProperty({ example: 'db24481c-add2-4ce1-8686-faf87997d404' })
  @IsUUID()
  mediaId!: string;

  @ApiProperty({ example: 'original/db24481c-add2-4ce1-8686-faf87997d404' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({ example: 12345678 })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}
