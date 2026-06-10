import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Attachment, AttachmentType } from '../../entities/attachment.entity';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
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

  async upload(
    file: Express.Multer.File,
    type?: AttachmentType,
    questionKey?: string,
    metadata?: Record<string, any>,
    submissionId?: string,
    projectId?: string,
  ) {
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
      projectId,
    });
    return this.attachmentRepo.save(attachment);
  }

  async findOne(id: string) {
    const attachment = await this.attachmentRepo.findOne({ where: { id } });
    if (!attachment) throw new NotFoundException('附件不存在');
    return attachment;
  }

  async remove(id: string) {
    const attachment = await this.findOne(id);
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
