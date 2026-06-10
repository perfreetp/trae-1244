import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { ReviewRecord } from './review-record.entity';

export enum UserRole {
  ADMIN = 'admin',
  CLIENT = 'client',
  COLLECTOR = 'collector',
  REVIEWER = 'reviewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    default: UserRole.COLLECTOR,
  })
  role: UserRole;

  @Column({ nullable: true })
  clientId: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Project, (p) => p.owner)
  projects: Project[];

  @OneToMany(() => ReviewRecord, (r) => r.reviewer)
  reviews: ReviewRecord[];
}
