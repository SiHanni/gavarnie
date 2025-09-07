import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { AvatarsService } from './avatars.service';
import {
  PresignAvatarDto,
  CompleteAvatarDto,
  PresignResponse,
  CompleteResponse,
} from './dto';

@ApiTags('avatars')
@ApiExtraModels(PresignResponse, CompleteResponse)
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly svc: AvatarsService) {}

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '아바타 업로드 Presigned URL 발급' })
  @ApiConsumes('application/json')
  @ApiBody({ type: PresignAvatarDto })
  @ApiOkResponse({
    description: 'PUT URL/headers/key 반환',
    type: PresignResponse,
  })
  presign(@Req() req: any, @Body() dto: PresignAvatarDto) {
    return this.svc.presign(
      req.user.userId as string,
      dto.contentType,
      dto.fileSize,
      dto.originalFilename,
    );
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '아바타 업로드 완료 → 리사이즈/정규화' })
  @ApiConsumes('application/json')
  @ApiBody({ type: CompleteAvatarDto })
  @ApiOkResponse({
    description: '최종 아바타 URL(및 변형 목록) 반환',
    type: CompleteResponse,
  })
  complete(@Req() req: any, @Body() dto: CompleteAvatarDto) {
    return this.svc.complete(req.user.userId as string, dto.key);
  }
}
