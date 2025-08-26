import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { CreatePresignDto } from './dto/create-presign.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@ApiTags('uploads')
@Controller('uploads')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  @ApiOperation({ summary: 'PUT Presigned URL 발급' })
  @ApiOkResponse({ description: 'URL/headers/key 포함' })
  presign(@Body() dto: CreatePresignDto) {
    return this.mediaService.createPresign(
      dto.originalFilename,
      dto.contentType,
    );
  }

  @Post('complete')
  @ApiOperation({ summary: '업로드 완료 통지 → 변환 큐 등록' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  complete(@Body() dto: CompleteUploadDto) {
    return this.mediaService.completeUpload(dto.mediaId, dto.key, dto.size);
  }

  @Get('media/:id/status')
  @ApiOperation({ summary: '미디어 처리 상태 조회' })
  status(@Param('id') id: string) {
    return this.mediaService.getStatus(id);
  }
}
