import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PresignAvatarDto {
  @ApiProperty({
    required: false,
    description:
      '브라우저에서 넘어온 MIME 타입 (예: image/jpeg). 없으면 서버가 파일명으로 추론',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiProperty({
    required: false,
    description: '파일 크기(바이트). 없으면 서버에서 HEAD로 확인',
    example: 123456,
  })
  @IsOptional()
  @Type(() => Number) // 문자열로 와도 숫자로 변환
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiProperty({
    required: false,
    description: '원본 파일명 (확장자 추론용)',
    example: 'me.jpg',
  })
  @IsOptional()
  @IsString()
  originalFilename?: string;
}

export class CompleteAvatarDto {
  @ApiProperty({
    description: 'presign으로 받은 key (업로드된 원본 경로)',
    example: 'avatars/raw/1b8a3f0c-3f2b-4d7f-8f2a-2c1f5f9e1234/me.jpg',
  })
  @IsString()
  key!: string;
}

export class PresignResponse {
  @ApiProperty({ example: 'https://minio.local/object/presigned' })
  url!: string;

  @ApiProperty({ example: 'PUT', enum: ['PUT'] })
  method!: 'PUT';

  @ApiProperty({
    description: 'S3 PUT에 사용할 헤더',
    example: { 'Content-Type': 'image/jpeg' },
  })
  headers!: Record<string, string>;

  @ApiProperty({
    description: '업로드 대상 오브젝트 키',
    example: 'avatars/raw/1b8a.../me.jpg',
  })
  key!: string;

  @ApiProperty({
    description: '서명 URL 만료(초)',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    nullable: true,
    description: '퍼블릭으로 접근 가능한 URL(설정 시). 없으면 null',
    example: 'https://cdn.example.com/avatars/raw/1b8a.../me.jpg',
  })
  publicUrl!: string | null;
}

export class CompleteResponse {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({
    description: '최종 대표 아바타 URL (예: 256 사이즈)',
    example: 'https://cdn.example.com/avatars/processed/u_12345/256.webp',
  })
  avatarUrl!: string;

  @ApiProperty({
    required: false,
    description: '생성된 모든 변형(사이즈) URL 목록 (있으면)',
    example: [
      'https://cdn.example.com/avatars/processed/u_12345/64.webp',
      'https://cdn.example.com/avatars/processed/u_12345/256.webp',
    ],
  })
  variants?: string[];
}
