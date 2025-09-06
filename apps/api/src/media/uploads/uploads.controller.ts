import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MediaService } from '../media.service';
import { CreatePresignDto } from '../dto/create-presign.dto';
import { CompleteUploadDto } from '../dto/complete-upload.dto';
// 주의: 프로젝트 경로에 맞춰 import 유지
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { UploadPolicyGuard } from './upload-policy.guard';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly mediaService: MediaService) {}

  /** 업로드 사전 승인 (정책 검사 + presigned PUT) */
  @UseGuards(JwtAuthGuard, UploadPolicyGuard)
  @Post('presign')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'PUT Presigned URL 발급' })
  @ApiOkResponse({ description: 'URL/headers/key 포함' })
  presign(
    @Req() req: any,
    @Body() dto: CreatePresignDto,
    @Headers('x-file-size') xFileSize?: string,
  ) {
    if (xFileSize) {
      const intended = Number(xFileSize);
      const policy = req.uploadPolicy as
        | { maxPerDay: number; maxFileMB: number }
        | undefined;
      if (
        policy &&
        Number.isFinite(intended) &&
        intended > policy.maxFileMB * 1024 * 1024
      ) {
        throw new BadRequestException(
          `파일이 등급 한도(${policy.maxFileMB}MB)를 초과합니다.`,
        );
      }
    }

    return this.mediaService.createPresign(
      dto.originalFilename,
      dto.contentType,
      req.user.userId as string,
      dto.title,
    );
  }

  /** 업로드 완료 통지 → 변환 큐 등록 */
  @UseGuards(JwtAuthGuard)
  @Post('complete')
  @ApiBearerAuth('access-token')
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

  /** 처리 상태 조회 — 인증 필요 + 소유자 검증(서비스에서 수행) */
  @UseGuards(JwtAuthGuard)
  @Get('media/:id/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '미디어 처리 상태 조회(소유자 전용)' })
  status(@Req() req: any, @Param('id') id: string) {
    // 서비스에서 (media.owner_id === req.user.userId) 검증 필요
    return this.mediaService.getStatus(id, req.user.userId as string);
  }
}
