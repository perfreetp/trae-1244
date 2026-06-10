import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Submission } from './submission.entity';

export enum AttachmentType {
  PHOTO = 'photo',
  AUDIO = 'audio',
  VIDEO = 'video',
  FILE = 'file',
}

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  submissionId: string;

  @ManyToOne(() => Submission, (s) => s.attachments, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column({ nullable: true })
  projectId: string;

  @Column({ nullable: true })
  questionKey: string;

  @Column({
    type: 'simple-enum',
    enum: AttachmentType,
  })
  type: AttachmentType;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column()
  filePath: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  uploadedAt: Date;
}
