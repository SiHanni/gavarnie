import { ApiProperty } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true })
  statusMessage!: string | null;

  /** 공개 프로필에도 handle을 항상 포함 */
  @ApiProperty()
  handle!: string;
}
