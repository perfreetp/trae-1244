import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Submission } from './submission.entity';

@Entity('submission_answers')
export class SubmissionAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  submissionId: string;

  @ManyToOne(() => Submission, (s) => s.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  questionKey: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'simple-json', nullable: true })
  valueJson: any;
}
