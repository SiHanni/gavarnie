import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { MediaReactionService } from './media-reaction.service';
import { LikeActionResultDto } from './dto/like-action-result.dto';
import { LikeCountDto } from './dto/like-count.dto';

@ApiTags('media-reaction')
@Controller('media/:mediaUuid')
export class MediaReactionController {
  constructor(private readonly mediaReactionService: MediaReactionService) {}

  @UseGuards(JwtAuthGuard)
  @Post('like')
  @ApiOperation({ summary: '영상 좋아요 (멱등)' })
  @ApiOkResponse({ type: LikeActionResultDto })
  async like(
    @Param('mediaUuid') mediaUuid: string,
    @Req() req: any,
  ): Promise<LikeActionResultDto> {
    const userId = String(req.user.id); // JWT 페이로드 구조에 맞게 조정
    return this.mediaReactionService.like(mediaUuid, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('like')
  @ApiOperation({ summary: '영상 좋아요 취소 (멱등)' })
  @ApiOkResponse({ type: LikeActionResultDto })
  async unlike(
    @Param('mediaUuid') mediaUuid: string,
    @Req() req: any,
  ): Promise<LikeActionResultDto> {
    const userId = String(req.user.id);
    return this.mediaReactionService.unlike(mediaUuid, userId);
  }

  @Get('likes/count')
  @ApiOperation({ summary: '영상 좋아요 수' })
  @ApiOkResponse({ type: LikeCountDto })
  async count(@Param('mediaUuid') mediaUuid: string): Promise<LikeCountDto> {
    return this.mediaReactionService.count(mediaUuid);
  }
}
