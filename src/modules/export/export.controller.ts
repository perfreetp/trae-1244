import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { ExportService } from './export.service';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';

@ApiTags('结果下载')
@ApiBearerAuth()
@Controller('export')
@UseGuards(AuthGuard('jwt'))
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('project/:projectId/valid')
  getValidSubmissions(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.exportService.getValidSubmissions(projectId, user);
  }

  @Get('project/:projectId/abnormal')
  getAbnormalSubmissions(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.exportService.getAbnormalSubmissions(projectId, user);
  }

  @Get('project/:projectId/download')
  async download(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('includeAbnormal') includeAbnormal: string,
    @Res() res: Response,
  ) {
    const zipPath = await this.exportService.generateExport(
      projectId,
      user,
      includeAbnormal === 'true',
    );
    const filename = zipPath.split(/[\\/]/).pop();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
  }
}
