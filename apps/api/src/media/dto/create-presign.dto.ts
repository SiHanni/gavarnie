import {
  IsIn,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePresignDto {
  @ApiProperty({ example: 'sample.mov' })
  @IsString()
  @IsNotEmpty()
  originalFilename!: string;

  @ApiProperty({ example: 'video/quicktime' })
  @IsMimeType()
  contentType!: string;

  @ApiPropertyOptional({ enum: ['video', 'audio'] })
  @IsOptional()
  @IsIn(['video', 'audio'])
  kind?: 'video' | 'audio';
}
