import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { AttachmentService } from './attachment.service';
import { AttachmentType } from '../../entities/attachment.entity';

@ApiTags('附件接收')
@ApiBearerAuth()
@Controller('attachments')
@UseGuards(AuthGuard('jwt'))
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['photo', 'audio', 'video', 'file'] },
        questionKey: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: AttachmentType = AttachmentType.FILE,
    @Query('questionKey') questionKey?: string,
  ) {
    return this.attachmentService.upload(file, type, questionKey);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.attachmentService.findOne(id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const attachment = await this.attachmentService.findOne(id);
    const stream = this.attachmentService.getStream(attachment);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
    });
    stream.pipe(res);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.attachmentService.remove(id);
  }
}
