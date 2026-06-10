import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import {
  CreateReviewDto,
  AssignReviewerDto,
  QueryReviewTodoDto,
} from './dto/review.dto';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { UserRole } from '../../entities/user.entity';

@ApiTags('质量复核')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(AuthGuard('jwt'))
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: '提交复核结论（复核员：仅可复核分配给自己的待办）' })
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.create(dto, user);
  }

  @Post('assign')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: '批量分配复核人员（CLIENT/ADMIN 可操作，将记录派给指定复核员形成待办）' })
  assignReviewer(
    @Body() dto: AssignReviewerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.assignReviewer(dto.submissionIds, dto.reviewerId, user);
  }

  @Post(':id/lock')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: '锁定记录（CLIENT 或 ADMIN）' })
  lock(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.lock(id, user);
  }

  @Post(':id/unlock')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: '解锁记录（CLIENT 或 ADMIN）' })
  unlock(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.unlock(id, user);
  }

  @Get('mine/todos')
  @Roles(UserRole.ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: '我的复核待办（按 assignedReviewer 分配的未完成任务）' })
  myReviewTodos(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryReviewTodoDto,
  ) {
    return this.reviewService.myReviewTodos(user, query);
  }

  @Get('mine/history')
  @Roles(UserRole.ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: '我的复核历史（我完成过的复核记录）' })
  myReviewHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.reviewService.myReviewHistory(user, projectId);
  }

  @Get('submission/:submissionId')
  findBySubmission(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.findBySubmission(submissionId, user);
  }
}
