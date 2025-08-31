import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly svc: CommentsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  @ApiOperation({ summary: '댓글 작성 (depth 댓글:0, 대댓글:1)' })
  async create(@Req() req: any, @Body() dto: CreateCommentDto) {
    const userId = req.user?.userId as string;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.svc.create(dto, userId);
  }

  @Get()
  @ApiOperation({
    summary: '댓글(대댓글) 목록, 커서 페이지 네이션 적용, 댓글(대댓글) 따로',
  })
  async list(@Query() q: ListCommentsQueryDto) {
    return this.svc.list({
      mediaId: q.mediaId,
      parentId: q.parentId,
      limit: q.limit ?? 20,
      cursor: q.cursor,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':commentId')
  @ApiOperation({ summary: 'Soft delete a comment (작성자 전용)' })
  async remove(@Req() req: any, @Param('commentId') commentId: string) {
    const userId = req.user?.userId as string;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.svc.softDelete(commentId, userId);
  }
}
