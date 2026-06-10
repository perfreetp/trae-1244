import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sample } from '../../entities/sample.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { SampleService } from './sample.service';
import { SampleController } from './sample.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sample, Project, User])],
  controllers: [SampleController],
  providers: [SampleService],
  exports: [SampleService],
})
export class SampleModule {}
