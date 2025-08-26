import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CompleteUploadDto {
  @IsUUID()
  mediaId!: string;

  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}
