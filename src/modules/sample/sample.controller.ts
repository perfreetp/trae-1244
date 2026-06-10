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
import { SampleService } from './sample.service';
import {
  CreateSampleDto,
  BatchCreateSampleDto,
  AssignSampleDto,
  UpdateSampleDto,
  QuerySampleDto,
} from './dto/sample.dto';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { UserRole } from '../../entities/user.entity';

@ApiTags('样本分配')
@ApiBearerAuth()
@Controller('samples')
@UseGuards(AuthGuard('jwt'))
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  create(
    @Body() dto: CreateSampleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.create(dto, user);
  }

  @Post('batch')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  batchCreate(
    @Body() dto: BatchCreateSampleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.batchCreate(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QuerySampleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.findAll(query, user);
  }

  @Get('mine')
  mySamples(
    @CurrentUser() user: CurrentUserPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.sampleService.mySamples(user, projectId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.findOne(id, user);
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignSampleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.assign(id, dto, user);
  }

  @Post('batch/assign')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  batchAssign(
    @Body() body: { sampleIds: string[]; assignedTo: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.batchAssign(body.sampleIds, body.assignedTo, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSampleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sampleService.remove(id, user);
  }
}
