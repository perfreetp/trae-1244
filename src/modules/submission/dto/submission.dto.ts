import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionStatus } from '../../../entities/submission.entity';

export class AnswerDto {
  @IsString()
  questionKey: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsOptional()
  valueJson?: any;
}

export class CreateSubmissionDto {
  @IsString()
  formId: string;

  @IsString()
  sampleId: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  locationAddress?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];

  @IsArray()
  @IsOptional()
  attachmentIds?: string[];
}

export class UpdateSubmissionDto {
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  locationAddress?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  @IsOptional()
  answers?: AnswerDto[];

  @IsArray()
  @IsOptional()
  attachmentIds?: string[];
}

export class QuerySubmissionDto {
  @IsString()
  projectId: string;

  @IsString()
  @IsOptional()
  formId?: string;

  @IsEnum(SubmissionStatus)
  @IsOptional()
  status?: SubmissionStatus;

  @IsString()
  @IsOptional()
  sampleId?: string;

  @IsString()
  @IsOptional()
  submittedBy?: string;

  @IsString()
  @IsOptional()
  keyword?: string;
}
