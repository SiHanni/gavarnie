import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MediaService } from '../media.service';
import { RecentQueryDto, RecentResponseDto } from '../dto/recent.dto';

@ApiTags('media')
@Controller('media')
export class PublicMediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** 글로벌 피드(READY) — 커서 페이지네이션 */
  @Get('recent')
  @ApiOperation({
    summary: 'READY 상태 미디어 목록 (최근 기준, 커서 기반 페이지네이션)',
  })
  @ApiOkResponse({ type: RecentResponseDto })
  async getRecent(
    @Req() req: any,
    @Query() query: RecentQueryDto,
  ): Promise<RecentResponseDto> {
    // 로그인 여부와 무관. 로그인 시 me-like 표시 등 확장 가능 → 서비스에 currentUserId 전달
    return this.mediaService.getRecent({
      limit: query.limit ?? 20,
      cursor: query.cursor,
      currentUserId: req.user?.userId,
    });
  }

  /** HLS 스트리밍 메타 (READY only) */
  @Get(':id')
  @ApiOperation({ summary: '스트리밍 메타 조회 (READY만 공개)' })
  @ApiOkResponse({
    schema: {
      example: {
        id: 'a1b2c3',
        status: 'READY',
        streamUrl: 'https://cdn.example.com/hls/a1b2c3/index.m3u8',
      },
    },
  })
  async getMedia(@Param('id') id: string) {
    const media = await this.mediaService.findOnePublicHlsMeta(id);
    if (!media) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const base = process.env.PUBLIC_CDN_BASE_URL || '';
    if (!base) {
      throw new HttpException(
        'PUBLIC_CDN_BASE_URL is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const streamUrl = `${base.replace(/\/+$/, '')}/${media.hlsKey}`;
    return { id: media.id, status: media.status, streamUrl };
  }
}
