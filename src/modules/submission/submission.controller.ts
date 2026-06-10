import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubmissionService } from './submission.service';
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  QuerySubmissionDto,
} from './dto/submission.dto';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';

@ApiTags('数据提交')
@ApiBearerAuth()
@Controller('submissions')
@UseGuards(AuthGuard('jwt'))
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  create(
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.submissionService.create(dto, user);
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.submissionService.submit(id, user);
  }

  @Post(':id/recall')
  recall(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.submissionService.recall(id, user);
  }

  @Get()
  findAll(
    @Query() query: QuerySubmissionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.submissionService.findAll(query, user);
  }

  @Get('mine')
  mySubmissions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.submissionService.mySubmissions(user, projectId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.submissionService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.submissionService.update(id, dto, user);
  }
}
