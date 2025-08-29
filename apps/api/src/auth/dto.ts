import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsString()
  displayNam!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;
}
