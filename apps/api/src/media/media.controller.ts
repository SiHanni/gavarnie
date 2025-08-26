import { Body, Controller, Post } from '@nestjs/common';
import { MediaService } from './media.service';
import { CreatePresignDto } from './dto/create-presign.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Controller('uploads')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  presign(@Body() dto: CreatePresignDto) {
    const kind = dto.kind ?? 'video';
    return this.mediaService.createPresign(
      dto.originalFilename,
      dto.contentType,
    );
  }

  @Post('complete')
  complete(@Body() dto: CompleteUploadDto) {
    return this.mediaService.completeUpload(dto.mediaId, dto.key, dto.size);
  }
}
