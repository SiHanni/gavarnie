import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
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
import { MediaReactionService } from './media-reaction.service';
import { LikeActionResultDto } from './dto/like-action-result.dto';
import { LikeCountDto } from './dto/like-count.dto';

@ApiTags('media-reaction')
@ApiParam({
  name: 'mediaUuid',
  description: '미디어 UUID (v4)',
  example: 'db24481c-add2-4ce1-8686-faf87997d404',
})
@Controller('media/:mediaUuid')
export class MediaReactionController {
  constructor(private readonly mediaReactionService: MediaReactionService) {}

  /** 좋아요 (idempotent) */
  @UseGuards(JwtAuthGuard)
  @Post('like')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '영상 좋아요' })
  @ApiOkResponse({ type: LikeActionResultDto })
  async like(
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mediaUuid: string,
    @Req() req: any,
  ): Promise<LikeActionResultDto> {
    const userId = req.user?.userId as string;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.mediaReactionService.like(mediaUuid, userId);
  }

  /** 좋아요 취소 (idempotent) */
  @UseGuards(JwtAuthGuard)
  @Delete('like')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '영상 좋아요 취소' })
  @ApiOkResponse({ type: LikeActionResultDto })
  async unlike(
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mediaUuid: string,
    @Req() req: any,
  ): Promise<LikeActionResultDto> {
    const userId = req.user?.userId as string;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.mediaReactionService.unlike(mediaUuid, userId);
  }

  /** 좋아요 수 (public) */
  @Get('likes/count')
  @ApiOperation({ summary: '영상 좋아요 수' })
  @ApiOkResponse({ type: LikeCountDto })
  async count(
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mediaUuid: string,
  ): Promise<LikeCountDto> {
    return this.mediaReactionService.count(mediaUuid);
  }
}
