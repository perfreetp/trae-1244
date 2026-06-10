import { IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewResult } from '../../../entities/review-record.entity';

export class IssueDto {
  @IsString()
  field: string;

  @IsString()
  message: string;
}

export class CreateReviewDto {
  @IsString()
  submissionId: string;

  @IsEnum(ReviewResult)
  result: ReviewResult;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueDto)
  @IsOptional()
  issues?: IssueDto[];
}

export class AssignReviewerDto {
  @IsArray()
  submissionIds: string[];

  @IsString()
  reviewerId: string;
}
