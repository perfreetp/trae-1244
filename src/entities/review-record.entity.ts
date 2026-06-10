import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { User } from './user.entity';

export enum ReviewResult {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_REVISION = 'needs_revision',
}

@Entity('review_records')
export class ReviewRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  submissionId: string;

  @ManyToOne(() => Submission, (s) => s.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  reviewerId: string;

  @ManyToOne(() => User, (u) => u.reviews)
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @Column({
    type: 'simple-enum',
    enum: ReviewResult,
  })
  result: ReviewResult;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'simple-json', nullable: true })
  issues: { field: string; message: string }[];

  @CreateDateColumn()
  reviewedAt: Date;
}
