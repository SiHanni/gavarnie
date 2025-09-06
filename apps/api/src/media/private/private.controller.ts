import {
  Controller,
  Delete,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { MediaService } from '../media.service';

@ApiTags('media-private')
@Controller('media/private')
export class PrivateMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Delete(':mediaUuid')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 콘텐츠 삭제(소프트 삭제, 본인만)' })
  async deleteMine(
    @Req() req: any,
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mediaUuid: string,
  ) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.mediaService.softDeleteMedia(mediaUuid, String(userId));
  }
}
