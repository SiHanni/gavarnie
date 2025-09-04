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
  UseInterceptors,
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
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { UploadPolicyGuard } from './upload-policy.guard';
import { UPLOAD_POLICY } from './upload-policy';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly mediaService: MediaService) {}

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

  @Get('media/:id/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '미디어 처리 상태 조회' })
  status(@Param('id') id: string) {
    return this.mediaService.getStatus(id);
  }
}
