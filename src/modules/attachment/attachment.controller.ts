import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AttachmentService } from './attachment.service';
import { AttachmentType } from '../../entities/attachment.entity';

class UploadAttachmentBodyDto {
  type?: AttachmentType;
  questionKey?: string;
  submissionId?: string;
  projectId?: string;
  metadata?: string | Record<string, any>;
}

@ApiTags('附件接收')
@ApiBearerAuth()
@Controller('attachments')
@UseGuards(AuthGuard('jwt'))
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
  @ApiOperation({
    summary:
      '上传附件（multipart/form-data），type/questionKey/metadata/submissionId/projectId 均作为表单字段传入；type 可选，不传时根据 mimetype 自动识别',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: '文件本体' },
        type: {
          type: 'string',
          enum: ['photo', 'audio', 'video', 'file'],
          description: '附件类型，可选，不填则根据 mimetype 自动识别',
        },
        questionKey: {
          type: 'string',
          description: '关联的表单题目 key（如 id_photo、voice_note）',
        },
        submissionId: {
          type: 'string',
          description: '可选：已有提交记录 ID（也可在创建/更新 submission 时通过 attachmentIds 关联）',
        },
        projectId: {
          type: 'string',
          description: '可选：项目 ID，用于提前绑定权限范围',
        },
        metadata: {
          type: 'object',
          description: '可选：JSON 元数据（如拍照 EXIF、录音时长、分辨率等），可传 JSON 字符串或直接传对象',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadAttachmentBodyDto,
  ) {
    if (!file) {
      throw new BadRequestException('未接收到文件，请确认 multipart 字段名为 file');
    }
    let metadataParsed: Record<string, any> | undefined;
    if (body.metadata) {
      try {
        metadataParsed =
          typeof body.metadata === 'string' ? JSON.parse(body.metadata) : body.metadata;
      } catch (e) {
        throw new BadRequestException('metadata 字段不是合法 JSON');
      }
    }
    return this.attachmentService.upload(
      file,
      body.type,
      body.questionKey,
      metadataParsed,
      body.submissionId,
      body.projectId,
    );
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
