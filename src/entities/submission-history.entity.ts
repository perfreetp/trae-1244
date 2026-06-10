import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Submission } from './submission.entity';

export enum HistoryAction {
  CREATED = 'created',
  UPDATED = 'updated',
  SUBMITTED = 'submitted',
  RECALLED = 'recalled',
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('submission_history')
export class SubmissionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  submissionId: string;

  @ManyToOne(() => Submission, (s) => s.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  actionBy: string;

  @Column({
    type: 'simple-enum',
    enum: HistoryAction,
  })
  action: HistoryAction;

  @Column({ type: 'simple-json', nullable: true })
  changes: Record<string, { old: any; new: any }>;

  @CreateDateColumn()
  actionAt: Date;
}
