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
}
