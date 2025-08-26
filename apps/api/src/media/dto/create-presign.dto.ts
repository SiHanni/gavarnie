import {
  IsIn,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePresignDto {
  @IsString()
  @IsNotEmpty()
  originalFilename!: string;

  @IsMimeType()
  contentType!: string;

  @IsOptional()
  @IsIn(['video', 'audio'])
  kind?: 'video' | 'audio';
}
