import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { SubmissionHistory } from '../../entities/submission-history.entity';
import { ReviewRecord } from '../../entities/review-record.entity';
import { Sample } from '../../entities/sample.entity';
import { User } from '../../entities/user.entity';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Submission,
      SubmissionHistory,
      ReviewRecord,
      Sample,
      User,
    ]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
