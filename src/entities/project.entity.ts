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
import { User } from './user.entity';
import { Form } from './form.entity';
import { Sample } from './sample.entity';

export enum ProjectStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'simple-enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  status: ProjectStatus;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, (u) => u.projects)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'text' })
  clientId: string;

  @Column({ type: 'text', nullable: true })
  region: string;

  @Column({ nullable: true })
  deadline: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Form, (f) => f.project)
  forms: Form[];

  @OneToMany(() => Sample, (s) => s.project)
  samples: Sample[];
}
