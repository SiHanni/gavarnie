import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secret1234' })
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  displayName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', minLength: 6, maxLength: 64 })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secret1234' })
  @MinLength(6)
  @MaxLength(64)
  password!: string;
}

export class MyProfileDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  email!: string;
  @ApiProperty()
  displayName!: string;
  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}
