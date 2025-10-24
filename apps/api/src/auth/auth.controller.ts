import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  SignupDto,
  MyProfileDto,
  VerifyCodeDto,
  EmailAvailableQueryDto,
  UpdatePasswordDto,
} from './dto';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('verify-code')
  @ApiOperation({ summary: '이메일 인증코드 검증(성공 시 검증 상태 확정)' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.auth.verifyCode(dto.email, dto.code, dto.purpose || 'signup');
  }

  @Post('signUp')
  @ApiOperation({
    summary: '회원가입(최근에 verify-code 성공한 이메일만 허용)',
  })
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
      },
    },
  })
  signUp(@Body() dto: SignupDto) {
    return this.auth.signUp(
      dto.email,
      dto.password,
      dto.passwordConfirm,
      dto.displayName,
    );
  }

  @Post('login')
  @ApiOperation({ summary: '로그인' })
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
      },
    },
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('profile')
  @ApiOkResponse({ type: MyProfileDto })
  async myProfile(@Req() req: any): Promise<MyProfileDto> {
    const userId = req.user?.userId as string;
    const user = await this.usersService.findById(userId);
    return {
      id: String(user.id),
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      statusMessage: user.statusMessage ?? null,
      handle: user.handle,
    };
  }

  @Get('email-available')
  @ApiOperation({ summary: '이메일 가용성 체크(이미 가입된 메일인지 확인)' })
  @ApiOkResponse({ schema: { example: { available: true } } })
  emailAvailable(@Query() q: EmailAvailableQueryDto) {
    return this.auth.emailAvailable(q.email);
  }

  @Patch('users/password')
  @ApiOperation({ summary: '관리자: 특정 사용자 비밀번호 수정' })
  @ApiNoContentResponse({ description: '변경 성공 (본문 없음)' })
  @ApiNotFoundResponse({ description: '사용자 없음' })
  @ApiForbiddenResponse({ description: '관리자 전용' })
  async updatePassword(@Body() dto: UpdatePasswordDto): Promise<void> {
    await this.auth.updateUserPasswordForAdmin(dto.email, dto.password);
  }
}
