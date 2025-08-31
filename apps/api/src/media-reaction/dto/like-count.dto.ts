import { ApiProperty } from '@nestjs/swagger';

export class LikeCountDto {
  @ApiProperty({ example: 123, description: 'isActive=1 기준 총 좋아요 수' })
  count!: number;
}
