import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Form, QuestionType } from './form.entity';

@Entity('form_questions')
export class FormQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  formId: string;

  @ManyToOne(() => Form, (f) => f.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: Form;

  @Column()
  questionKey: string;

  @Column()
  label: string;

  @Column({
    type: 'simple-enum',
    enum: QuestionType,
  })
  type: QuestionType;

  @Column({ default: false })
  required: boolean;

  @Column({ default: 0 })
  order: number;

  @Column({ type: 'simple-json', nullable: true })
  options: string[];

  @Column({ type: 'text', nullable: true })
  placeholder: string;

  @Column({ type: 'text', nullable: true })
  validationRule: string;

  @Column({ type: 'simple-json', nullable: true })
  extra: Record<string, any>;
}
