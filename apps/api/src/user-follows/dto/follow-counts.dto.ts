import { ApiProperty } from '@nestjs/swagger';

export class FollowCountsDto {
  @ApiProperty({ example: 42, description: '대상 사용자를 팔로우하는 사람 수' })
  followerCount!: number;

  @ApiProperty({ example: 17, description: '대상 사용자가 팔로우하는 사람 수' })
  followingCount!: number;
}
