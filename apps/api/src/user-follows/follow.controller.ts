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

@ApiTags('user-follow')
@ApiParam({
  name: 'userId',
  description: '팔로우 대상 사용자 ID (BIGINT)',
  example: '1234567890123',
})
@Controller('users/:userId')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @UseGuards(JwtAuthGuard)
  @Post('follow')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '사용자 팔로우' })
  @ApiOkResponse({ type: FollowActionResultDto })
  async follow(
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<FollowActionResultDto> {
    const me = req.user?.userId as string | undefined;
    if (!me) throw new UnauthorizedException('Authentication required.');
    return this.followService.follow(userId, String(me));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('follow')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '사용자 언팔로우' })
  @ApiOkResponse({ type: FollowActionResultDto })
  async unfollow(
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<FollowActionResultDto> {
    const me = req.user?.userId as string | undefined;
    if (!me) throw new UnauthorizedException('Authentication required.');
    return this.followService.unfollow(userId, String(me));
  }

  @UseGuards(JwtAuthGuard)
  @Get('follow/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '팔로우 상태 조회(현재 사용자 → 대상 사용자)' })
  @ApiOkResponse({ type: FollowStatusDto })
  async status(
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<FollowStatusDto> {
    const me = req.user?.userId as string | undefined;
    if (!me) throw new UnauthorizedException('Authentication required.');
    return this.followService.isFollowing(userId, String(me));
  }

  @Get('follow/counts')
  @ApiOperation({ summary: '대상 사용자의 팔로워/팔로잉 수' })
  @ApiOkResponse({ type: FollowCountsDto })
  async counts(@Param('userId') userId: string): Promise<FollowCountsDto> {
    return this.followService.counts(userId);
  }
}
