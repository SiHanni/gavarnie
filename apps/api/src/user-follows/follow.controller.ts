import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { FollowService } from './follow.service';
import { FollowActionResultDto } from './dto/follow-action-result.dto';
import { FollowCountsDto } from './dto/follow-counts.dto';
import { FollowStatusDto } from './dto/follow-status.dto';
import { UsersService } from '../users/users.service';

@ApiTags('user-follow')
@ApiParam({
  name: 'handle',
  description: '팔로우 대상 사용자 @handle (소문자 영숫자/._, 3–30자)',
  example: 'iammingki',
})
@Controller('users/handle/:handle')
export class FollowController {
  constructor(
    private readonly followService: FollowService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('follow')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '사용자 팔로우 (by handle)' })
  @ApiOkResponse({ type: FollowActionResultDto })
  async follow(
    @Param('handle') handle: string,
    @Req() req: any,
  ): Promise<FollowActionResultDto> {
    const me = req.user?.userId as string | undefined;
    if (!me) throw new UnauthorizedException('Authentication required.');
    const target = await this.usersService.findByHandle(handle);
    return this.followService.follow(String(target.id), String(me));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('follow')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '사용자 언팔로우 (by handle)' })
  @ApiOkResponse({ type: FollowActionResultDto })
  async unfollow(
    @Param('handle') handle: string,
    @Req() req: any,
  ): Promise<FollowActionResultDto> {
    const me = req.user?.userId as string | undefined;
    if (!me) throw new UnauthorizedException('Authentication required.');
    const target = await this.usersService.findByHandle(handle);
    return this.followService.unfollow(String(target.id), String(me));
  }

  @UseGuards(JwtAuthGuard)
  @Get('follow/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '팔로우 상태 조회 (현재 사용자 → 대상 사용자, by handle)',
  })
  @ApiOkResponse({ type: FollowStatusDto })
  async status(
    @Param('handle') handle: string,
    @Req() req: any,
  ): Promise<FollowStatusDto> {
    const me = req.user?.userId as string | undefined;
    if (!me) throw new UnauthorizedException('Authentication required.');
    const target = await this.usersService.findByHandle(handle);
    return this.followService.isFollowing(String(target.id), String(me));
  }

  @Get('follow/counts')
  @ApiOperation({
    summary: '대상 사용자의 팔로워/팔로잉 수 (by handle, public)',
  })
  @ApiOkResponse({ type: FollowCountsDto })
  async counts(@Param('handle') handle: string): Promise<FollowCountsDto> {
    const target = await this.usersService.findByHandle(handle);
    return this.followService.counts(String(target.id));
  }
}
