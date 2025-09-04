import {
  //IsIn,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePresignDto {
  @ApiProperty({ example: 'f1-radio.mp3' })
  @IsString()
  @IsNotEmpty()
  originalFilename!: string;

  @ApiProperty({ example: 'F1 팀라디오 알림사운드' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ example: 'audio/mpeg' })
  @IsOptional()
  @IsMimeType()
  contentType?: string;

  // DEPRECATED
  //@ApiPropertyOptional({ enum: ['video', 'audio'] })
  //@IsOptional()
  //@IsIn(['video', 'audio'])
  //kind?: 'video' | 'audio';
}
