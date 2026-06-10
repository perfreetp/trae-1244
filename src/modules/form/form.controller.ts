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
import { FormService } from './form.service';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { UserRole } from '../../entities/user.entity';

@ApiTags('表单发布')
@ApiBearerAuth()
@Controller('forms')
@UseGuards(AuthGuard('jwt'))
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  create(
    @Body() dto: CreateFormDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.formService.create(dto, user);
  }

  @Get()
  findByProject(
    @Query('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.formService.findByProject(projectId, user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.formService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.formService.update(id, dto, user);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  publish(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.formService.publish(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.formService.remove(id, user);
  }
}
