import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SampleStatus } from '../../../entities/sample.entity';

export class CreateSampleDto {
  @IsString()
  projectId: string;

  @IsString()
  uniqueCode: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;

  @IsString()
  @IsOptional()
  assignedTo?: string;
}

export class BatchCreateSampleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSampleDto)
  samples: CreateSampleDto[];
}

export class AssignSampleDto {
  @IsString()
  assignedTo: string;
}

export class UpdateSampleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;

  @IsEnum(SampleStatus)
  @IsOptional()
  status?: SampleStatus;
}

export class QuerySampleDto {
  @IsString()
  projectId: string;

  @IsEnum(SampleStatus)
  @IsOptional()
  status?: SampleStatus;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  assignedTo?: string;

  @IsString()
  @IsOptional()
  keyword?: string;
}
