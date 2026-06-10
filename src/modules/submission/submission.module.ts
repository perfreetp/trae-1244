import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAnswer } from '../../entities/submission-answer.entity';
import { SubmissionHistory } from '../../entities/submission-history.entity';
import { Form } from '../../entities/form.entity';
import { FormQuestion } from '../../entities/form-question.entity';
import { Sample } from '../../entities/sample.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Project } from '../../entities/project.entity';
import { SubmissionService } from './submission.service';
import { SubmissionController } from './submission.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Submission,
      SubmissionAnswer,
      SubmissionHistory,
      Form,
      FormQuestion,
      Sample,
      Attachment,
      Project,
    ]),
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
