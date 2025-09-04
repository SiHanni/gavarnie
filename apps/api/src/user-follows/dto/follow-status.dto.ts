import { ApiProperty } from '@nestjs/swagger';

export class FollowStatusDto {
  @ApiProperty({
    example: true,
    description: '현재 사용자 → 대상 사용자 팔로우 중?',
  })
  following!: boolean;
}
