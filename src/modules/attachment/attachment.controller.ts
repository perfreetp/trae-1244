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
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AttachmentService, QueryAttachmentDto } from './attachment.service';
import { AttachmentType } from '../../entities/attachment.entity';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';

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
      '上传附件（multipart/form-data），自动校验绑定的 submissionId/projectId 归属，跨客户上传将被拒绝',
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
          description: '可选：已有提交记录 ID（会校验归属，跨客户绑定将被拒绝）',
        },
        projectId: {
          type: 'string',
          description: '可选：项目 ID（会校验归属）',
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
    @CurrentUser() user: CurrentUserPayload,
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
      user,
    );
  }

  @Get()
  @ApiOperation({
    summary: '附件列表查询：按项目/提交/题目key/类型筛选，角色自动过滤可见范围',
  })
  @ApiQuery({ name: 'projectId', required: false, description: '按项目 ID 筛选' })
  @ApiQuery({ name: 'submissionId', required: false, description: '按提交记录 ID 筛选' })
  @ApiQuery({ name: 'questionKey', required: false, description: '按题目 key 筛选' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['photo', 'audio', 'video', 'file'],
    description: '按附件类型筛选',
  })
  async findAll(
    @Query() query: QueryAttachmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.attachmentService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '查看附件信息（自动校验归属，跨客户访问被拒绝）' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.attachmentService.findOne(id, user);
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载附件（自动校验归属，跨客户无法下载他人附件）' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentService.findOne(id, user);
    const stream = this.attachmentService.getStream(attachment);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
    });
    stream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除附件（自动校验归属）' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.attachmentService.remove(id, user);
  }
}
