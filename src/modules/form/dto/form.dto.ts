import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FormStatus, QuestionType } from '../../../entities/form.entity';

export class QuestionDto {
  @IsString()
  questionKey: string;

  @IsString()
  label: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsArray()
  @IsOptional()
  options?: string[];

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsString()
  @IsOptional()
  validationRule?: string;

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;
}

export class CreateFormDto {
  @IsString()
  projectId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions: QuestionDto[];
}

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FormStatus)
  @IsOptional()
  status?: FormStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  @IsOptional()
  questions?: QuestionDto[];
}
