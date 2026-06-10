import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { FormModule } from './modules/form/form.module';
import { SampleModule } from './modules/sample/sample.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { AttachmentModule } from './modules/attachment/attachment.module';
import { ReviewModule } from './modules/review/review.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ExportModule } from './modules/export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_DATABASE || './data/collection.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    ProjectModule,
    FormModule,
    SampleModule,
    SubmissionModule,
    AttachmentModule,
    ReviewModule,
    ProgressModule,
    ExportModule,
  ],
})
export class AppModule {}
