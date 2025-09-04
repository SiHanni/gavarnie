import { ApiProperty } from '@nestjs/swagger';

export class FollowActionResultDto {
  @ApiProperty({ example: true, description: '팔로우 중 여부' })
  following!: boolean;

  @ApiProperty({
    example: false,
    description: '이미 동일 상태였는지(멱등 동작 결과)',
  })
  alreadyExisted!: boolean;
}
