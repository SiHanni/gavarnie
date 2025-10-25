import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secret1234' })
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'secret1234' })
  @MinLength(6)
  @MaxLength(64)
  passwordConfirm!: string;

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
  @ApiProperty({ nullable: true })
  statusMessage!: string | null;
  @ApiProperty()
  handle!: string;
}

export class VerifyCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: '6자리 숫자 코드' })
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ example: 'signup', required: false })
  @IsString()
  purpose?: string; // 기본 'signup'
}

export class EmailAvailableQueryDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
