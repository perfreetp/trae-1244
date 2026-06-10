import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { Sample } from '../../entities/sample.entity';
import { Submission } from '../../entities/submission.entity';
import { User } from '../../entities/user.entity';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Sample, Submission, User])],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
