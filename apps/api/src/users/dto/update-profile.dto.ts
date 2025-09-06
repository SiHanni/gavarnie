import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '표시 이름(닉네임)' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: '아바타 URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ description: '상태 메시지' })
  @IsOptional()
  @IsString()
  statusMessage?: string | null;

  @ApiPropertyOptional({
    description:
      '변경할 핸들(소문자 영숫자/._, 길이 3-30, 숫자 전용 금지, 예약어/중복 불가)',
  })
  @IsOptional()
  @IsString()
  handle?: string;
}
