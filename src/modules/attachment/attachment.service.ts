import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Attachment, AttachmentType } from '../../entities/attachment.entity';
import { Submission } from '../../entities/submission.entity';
import { Project } from '../../entities/project.entity';
import { UserRole } from '../../entities/user.entity';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
  ) {}

  private getUploadDir() {
    const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private detectTypeByMime(mimeType: string, originalName: string): AttachmentType {
    const mime = (mimeType || '').toLowerCase();
    const ext = path.extname(originalName || '').toLowerCase();
    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'].includes(ext)) {
      return AttachmentType.PHOTO;
    }
    if (mime.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.amr'].includes(ext)) {
      return AttachmentType.AUDIO;
    }
    if (mime.startsWith('video/') || ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
      return AttachmentType.VIDEO;
    }
    return AttachmentType.FILE;
  }

  private async resolveClientId(
    submissionId?: string,
    projectId?: string,
  ): Promise<{ projectId?: string; clientId?: string }> {
    if (submissionId) {
      const sub = await this.submissionRepo.findOne({
        where: { id: submissionId },
        relations: ['sample', 'sample.project'],
      });
      if (!sub) {
        throw new BadRequestException('传入的 submissionId 不存在');
      }
      const project = (sub.sample as any)?.project as Project;
      return { projectId: project?.id, clientId: project?.clientId };
    }
    if (projectId) {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (!project) {
        throw new BadRequestException('传入的 projectId 不存在');
      }
      return { projectId: project.id, clientId: project.clientId };
    }
    return {};
  }

  async upload(
    file: Express.Multer.File,
    type: AttachmentType | undefined,
    questionKey: string | undefined,
    metadata: Record<string, any> | undefined,
    submissionId: string | undefined,
    projectId: string | undefined,
    user: CurrentUserPayload,
  ) {
    const resolved = await this.resolveClientId(submissionId, projectId);

    if (user.role !== UserRole.ADMIN) {
      if (resolved.clientId && resolved.clientId !== user.clientId) {
        throw new ForbiddenException(
          '无权上传：绑定的 submissionId/projectId 属于其他调用方(clientId)',
        );
      }
    }

    const finalType = type || this.detectTypeByMime(file.mimetype, file.originalname);
    const uploadDir = this.getUploadDir();

    const typeDir = path.join(uploadDir, finalType);
    if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(typeDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    const attachment = this.attachmentRepo.create({
      type: finalType,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath,
      questionKey,
      metadata,
      submissionId,
      projectId: resolved.projectId || projectId,
    });
    return this.attachmentRepo.save(attachment);
  }

  private async checkAttachmentAccess(attachment: Attachment, user: CurrentUserPayload) {
    if (user.role === UserRole.ADMIN) return;

    let clientId: string | undefined;
    if (attachment.submissionId) {
      const sub = await this.submissionRepo.findOne({
        where: { id: attachment.submissionId },
        relations: ['sample', 'sample.project'],
      });
      clientId = sub ? (sub.sample as any)?.project?.clientId : undefined;
    } else if (attachment.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: attachment.projectId } });
      clientId = project?.clientId;
    }

    if (clientId && clientId !== user.clientId) {
      throw new ForbiddenException('无权访问：该附件属于其他调用方(clientId)');
    }

    if (user.role === UserRole.COLLECTOR) {
      if (attachment.submissionId) {
        const sub = await this.submissionRepo.findOne({
          where: { id: attachment.submissionId },
        });
        if (sub && sub.submittedBy && sub.submittedBy !== user.id) {
          throw new ForbiddenException('无权访问：该附件属于其他采集员的提交记录');
        }
      }
    }
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const attachment = await this.attachmentRepo.findOne({ where: { id } });
    if (!attachment) throw new NotFoundException('附件不存在');
    await this.checkAttachmentAccess(attachment, user);
    return attachment;
  }

  async remove(id: string, user: CurrentUserPayload) {
    const attachment = await this.findOne(id, user);
    if (fs.existsSync(attachment.filePath)) {
      try {
        fs.unlinkSync(attachment.filePath);
      } catch (e) {
      }
    }
    await this.attachmentRepo.remove(attachment);
    return { success: true };
  }

  getStream(attachment: Attachment) {
    if (!fs.existsSync(attachment.filePath)) {
      throw new NotFoundException('文件不存在');
    }
    return fs.createReadStream(attachment.filePath);
  }
}
