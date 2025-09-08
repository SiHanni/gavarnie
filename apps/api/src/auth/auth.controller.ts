import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto, MyProfileDto } from './dto';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('signUp')
  @ApiOperation({ summary: '회원가입' })
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
      },
    },
  })
  signUp(@Body() dto: SignupDto) {
    return this.auth.signUp(dto.email, dto.password, dto.displayName);
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
}
