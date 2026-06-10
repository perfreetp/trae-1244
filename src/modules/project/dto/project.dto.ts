import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ProjectStatus } from '../../../entities/project.entity';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;
}

export class QueryProjectDto {
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  keyword?: string;
}
