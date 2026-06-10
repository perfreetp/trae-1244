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
import { Project } from './project.entity';
import { FormQuestion } from './form-question.entity';
import { Submission } from './submission.entity';

export enum FormStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
}

export enum QuestionType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  DATE = 'date',
  TIME = 'time',
  LOCATION = 'location',
  PHOTO = 'photo',
  AUDIO = 'audio',
  FILE = 'file',
}

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, (p) => p.forms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 1 })
  version: number;

  @Column({
    type: 'simple-enum',
    enum: FormStatus,
    default: FormStatus.DRAFT,
  })
  status: FormStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => FormQuestion, (q) => q.form, { cascade: true })
  questions: FormQuestion[];

  @OneToMany(() => Submission, (s) => s.form)
  submissions: Submission[];
}
