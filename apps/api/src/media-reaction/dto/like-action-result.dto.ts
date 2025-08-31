import { ApiProperty } from '@nestjs/swagger';

export class LikeActionResultDto {
  @ApiProperty({ example: true, description: '현재 좋아요 상태' })
  liked!: boolean;

  @ApiProperty({ example: false, description: '동일 상태였는지' })
  alreadyExisted!: boolean;
}
