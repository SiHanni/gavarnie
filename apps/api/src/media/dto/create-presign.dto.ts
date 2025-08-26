import {
  IsIn,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePresignDto {
  @ApiProperty({ example: 'f1-radio.mp3' })
  @IsString()
  @IsNotEmpty()
  originalFilename!: string;

  @ApiProperty({ example: 'audio/mpeg' })
  @IsMimeType()
  contentType!: string;

  @ApiPropertyOptional({ enum: ['video', 'audio'] })
  @IsOptional()
  @IsIn(['video', 'audio'])
  kind?: 'video' | 'audio';
}
