import {
  Body,
  Controller,
  Get,
  Param,
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
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto, MyProfileDto } from './dto';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { PublicUserDto } from '../users/dto/public-user.dto';
import {
  UserMediaQueryDto,
  UserMediaResponseDto,
} from '../users/dto/user-media.dto';

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
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 프로필 수정' })
  async updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(req.user.userId as string, dto);
  }

  // --- 공개 프로필 + 공개 미디어 ---
  @Get(':id')
  @ApiOperation({ summary: '공개 프로필 조회' })
  @ApiOkResponse({ type: PublicUserDto })
  async publicProfile(@Param('id') id: string): Promise<PublicUserDto> {
    return this.usersService.getPublicProfile(id);
  }

  @Get(':id/media')
  @ApiOperation({
    summary: '특정 사용자의 공개 미디어 목록(커서 페이지네이션)',
  })
  @ApiOkResponse({ type: UserMediaResponseDto })
  async userMedia(
    @Param('id') id: string,
    @Query() q: UserMediaQueryDto,
  ): Promise<UserMediaResponseDto> {
    return this.usersService.getUserMedia(id, q);
  }
}
