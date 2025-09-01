import {
  Controller,
  Put,
  Delete,
  Get,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CommentReactionsService } from './comment-reactions.service';

@ApiTags('comment-reactions')
@Controller('comments/:commentId')
export class CommentReactionsController {
  constructor(private readonly svc: CommentReactionsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Put('like')
  @ApiOperation({ summary: '댓글 좋아용 (idempotent)' })
  async like(@Req() req: any, @Param('commentId') commentId: string) {
    const userId = req.user?.userId as string;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.svc.like(commentId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete('like')
  @ApiOperation({ summary: '댓글 좋아요 취소 (idempotent)' })
  async unlike(@Req() req: any, @Param('commentId') commentId: string) {
    const userId = req.user?.userId as string;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.svc.unlike(commentId, userId);
  }

  @Get('likes')
  @ApiOperation({ summary: '댓글 좋아요 카운트 (public)' })
  async count(@Param('commentId') commentId: string) {
    return this.svc.count(commentId);
  }
}
