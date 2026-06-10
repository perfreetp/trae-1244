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

  async upload(
    file: Express.Multer.File,
    type: AttachmentType,
    questionKey?: string,
    metadata?: Record<string, any>,
  ) {
    const uploadDir = this.getUploadDir();
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    const attachment = this.attachmentRepo.create({
      type,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath,
      questionKey,
      metadata,
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
      fs.unlinkSync(attachment.filePath);
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
