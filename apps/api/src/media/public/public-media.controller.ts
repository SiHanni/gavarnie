import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MediaService } from '../media.service';
import { RecentQueryDto, RecentResponseDto } from '../dto/recent.dto';

@ApiTags('media')
@Controller('media')
export class PublicMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':id')
  @ApiOperation({ summary: '스트리밍 메타 조회 (READY만 공개)' })
  @ApiOkResponse({
    schema: {
      example: {
        id: 'a1b2c3',
        status: 'READY',
        streamUrl: 'http://localhost:18080/media/hls/a1b2c3/index.m3u8',
      },
    },
  })
  async getMedia(@Param('id') id: string) {
    const media = await this.mediaService.findOne(id);
    if (!media) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    if (media.status !== 'READY' || !media.hlsKey) {
      throw new HttpException('Media is not READY', HttpStatus.CONFLICT);
    }

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

  @Get('recent')
  @ApiOperation({
    summary: 'READY 상태 미디어 목록 (최근 기준, 커서 기반 페이지네이션)',
  })
  @ApiOkResponse({ type: RecentResponseDto })
  async getRecent(@Query() query: RecentQueryDto): Promise<RecentResponseDto> {
    return this.mediaService.getRecent(query);
  }
}
