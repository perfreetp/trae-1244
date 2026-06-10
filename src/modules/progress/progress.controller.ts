import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { UserRole } from '../../entities/user.entity';

@ApiTags('进度查询')
@ApiBearerAuth()
@Controller('progress')
@UseGuards(AuthGuard('jwt'))
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('project/:projectId')
  getProjectProgress(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.progressService.getProjectProgress(projectId, user);
  }

  @Get('project/:projectId/by-region')
  getProgressByRegion(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.progressService.getProgressByRegion(projectId, user);
  }

  @Get('project/:projectId/by-collector')
  getProgressByCollector(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.progressService.getProgressByCollector(projectId, user);
  }

  @Get('project/:projectId/pending')
  getPendingSamples(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.progressService.getPendingSamples(projectId, user);
  }

  @Post('remind')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  remind(
    @Body() body: { sampleIds: string[] },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.progressService.remind(body.sampleIds, user);
  }
}
