import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Form } from '../../entities/form.entity';
import { FormQuestion } from '../../entities/form-question.entity';
import { Project } from '../../entities/project.entity';
import { FormService } from './form.service';
import { FormController } from './form.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Form, FormQuestion, Project])],
  controllers: [FormController],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}
