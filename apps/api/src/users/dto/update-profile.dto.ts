import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '르클레르', description: '표시 이름' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/a.png',
    description: '프로필 이미지 URL (http/https)',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    example: 'test status message',
    description: '상태 메세지',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  statusMessage?: string;
}
