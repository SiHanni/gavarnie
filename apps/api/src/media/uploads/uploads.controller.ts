import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaService } from '../media.service';
import { CreatePresignDto } from '../dto/create-presign.dto';
import { CompleteUploadDto } from '../dto/complete-upload.dto';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('presign')
  @ApiOperation({ summary: 'PUT Presigned URL 발급' })
  @ApiOkResponse({ description: 'URL/headers/key 포함' })
  presign(@Req() req: any, @Body() dto: CreatePresignDto) {
    return this.mediaService.createPresign(
      dto.originalFilename,
      dto.contentType,
      req.user.userId as string,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete')
  @ApiOperation({ summary: '업로드 완료 통지 → 변환 큐 등록' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  complete(@Req() req: any, @Body() dto: CompleteUploadDto) {
    return this.mediaService.completeUpload(
      dto.mediaId,
      dto.key,
      req.user.userId as string,
      dto.size,
    );
  }

  @Get('media/:id/status')
  @ApiOperation({ summary: '미디어 처리 상태 조회' })
  status(@Param('id') id: string) {
    return this.mediaService.getStatus(id);
  }
}
