import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard'; // 프로젝트 경로에 맞게 조정
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PublicUserDto } from './dto/public-user.dto';
import { UserMediaQueryDto, UserMediaResponseDto } from './dto/user-media.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // --- 내 프로필 ---
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 프로필 조회' })
  async myProfile(@Req() req: any) {
    return this.users.findById(req.user.userId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 프로필 수정(@handle 변경 포함)' })
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(req.user.userId as string, dto);
  }

  @Get('handle/:handle')
  @ApiOperation({ summary: '공개 프로필 조회 (by handle)' })
  @ApiOkResponse({ type: PublicUserDto })
  async publicProfileByHandle(
    @Param('handle') handle: string,
  ): Promise<PublicUserDto> {
    return this.users.getPublicProfileByHandle(handle);
  }

  @Get('handle/:handle/media')
  @ApiOperation({
    summary: '특정 사용자의 공개 미디어 목록(커서 페이지네이션, by handle)',
  })
  @ApiOkResponse({ type: UserMediaResponseDto })
  async userMediaByHandle(
    @Param('handle') handle: string,
    @Query() q: UserMediaQueryDto,
  ): Promise<UserMediaResponseDto> {
    return this.users.getUserMediaByHandle(handle, q);
  }
}
