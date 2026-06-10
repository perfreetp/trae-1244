import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectDto,
} from './dto/project.dto';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { UserRole } from '../../entities/user.entity';

@ApiTags('项目管理')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryProjectDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectService.remove(id, user);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  publish(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectService.publish(id, user);
  }
}
