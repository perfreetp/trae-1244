import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Form } from './form.entity';
import { Sample } from './sample.entity';
import { SubmissionAnswer } from './submission-answer.entity';
import { Attachment } from './attachment.entity';
import { ReviewRecord } from './review-record.entity';
import { SubmissionHistory } from './submission-history.entity';

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  LOCKED = 'locked',
}

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  formId: string;

  @ManyToOne(() => Form, (f) => f.submissions)
  @JoinColumn({ name: 'formId' })
  form: Form;

  @Column()
  sampleId: string;

  @ManyToOne(() => Sample, (s) => s.submissions)
  @JoinColumn({ name: 'sampleId' })
  sample: Sample;

  @Column()
  submittedBy: string;

  @Column({ type: 'real', nullable: true })
  latitude: number;

  @Column({ type: 'real', nullable: true })
  longitude: number;

  @Column({ type: 'text', nullable: true })
  locationAddress: string;

  @Column({
    type: 'simple-enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.DRAFT,
  })
  status: SubmissionStatus;

  @Column({ type: 'simple-json', nullable: true })
  validationIssues: {
    type: 'duplicate' | 'missing' | 'invalid';
    field: string;
    message: string;
  }[];

  @Column({ default: false })
  hasDuplicate: boolean;

  @Column({ default: false })
  hasMissing: boolean;

  @Column({ default: false })
  isLocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  submittedAt: Date;

  @OneToMany(() => SubmissionAnswer, (a) => a.submission, { cascade: true })
  answers: SubmissionAnswer[];

  @OneToMany(() => Attachment, (a) => a.submission, { cascade: true })
  attachments: Attachment[];

  @OneToMany(() => ReviewRecord, (r) => r.submission)
  reviews: ReviewRecord[];

  @OneToMany(() => SubmissionHistory, (h) => h.submission)
  history: SubmissionHistory[];
}
