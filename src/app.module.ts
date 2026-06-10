import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { FormModule } from './modules/form/form.module';
import { SampleModule } from './modules/sample/sample.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { AttachmentModule } from './modules/attachment/attachment.module';
import { ReviewModule } from './modules/review/review.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ExportModule } from './modules/export/export.module';

const DATA_DIR = path.resolve('./data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SQLITE_FILE = process.env.DB_DATABASE || `${DATA_DIR}/collection.db`;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: true,
      location: SQLITE_FILE,
      driver: initSqlJs,
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
