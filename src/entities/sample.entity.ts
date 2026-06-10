import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { Submission } from './submission.entity';

export enum SampleStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed',
  INVALID = 'invalid',
}

@Entity('samples')
export class Sample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, (p) => p.samples, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  uniqueCode: string;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  region: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({ type: 'simple-json', nullable: true })
  extra: Record<string, any>;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({
    type: 'simple-enum',
    enum: SampleStatus,
    default: SampleStatus.PENDING,
  })
  status: SampleStatus;

  @Column({ nullable: true })
  remindedAt: Date;

  @Column({ default: 0 })
  remindCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Submission, (s) => s.sample)
  submissions: Submission[];
}
