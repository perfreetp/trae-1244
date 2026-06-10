import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { Sample } from '../../entities/sample.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAnswer } from '../../entities/submission-answer.entity';
import { Form } from '../../entities/form.entity';
import { FormQuestion } from '../../entities/form-question.entity';
import { Attachment } from '../../entities/attachment.entity';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Sample,
      Submission,
      SubmissionAnswer,
      Form,
      FormQuestion,
      Attachment,
    ]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
