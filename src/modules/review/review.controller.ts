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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { CreateReviewDto, AssignReviewerDto } from './dto/review.dto';
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
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.create(dto, user);
  }

  @Post('assign')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  assignReviewer(
    @Body() dto: AssignReviewerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.assignReviewer(dto.submissionIds, dto.reviewerId, user);
  }

  @Post(':id/lock')
  @Roles(UserRole.ADMIN, UserRole.REVIEWER)
  lock(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.lock(id, user);
  }

  @Post(':id/unlock')
  @Roles(UserRole.ADMIN)
  unlock(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.unlock(id, user);
  }

  @Get('mine')
  myReviews(
    @CurrentUser() user: CurrentUserPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.reviewService.myReviews(user, projectId);
  }

  @Get('submission/:submissionId')
  findBySubmission(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewService.findBySubmission(submissionId, user);
  }
}
