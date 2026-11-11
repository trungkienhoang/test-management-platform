import {
  Controller,
  Get,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports & Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê tổng hợp Dashboard cho dự án' })
  async getDashboard(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getProjectDashboard(projectId, user);
  }

  @Get('reports/dashboard')
  @ApiOperation({ summary: 'Alias lấy dữ liệu thống kê tổng hợp Dashboard cho dự án' })
  async getReportsDashboard(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getProjectDashboard(projectId, user);
  }

  @Get('reports/test-runs/:runId/summary')
  @ApiOperation({ summary: 'Lấy dữ liệu chi tiết báo cáo đợt kiểm thử (Test Run Report)' })
  async getTestRunSummary(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getTestRunSummary(projectId, runId, user);
  }

  @Get('reports/test-runs/:runId/excel')
  @ApiOperation({ summary: 'Xuất file Excel (.xlsx) báo cáo tổng kết Test Run' })
  async exportTestRunExcel(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportTestRunExcel(projectId, runId, user);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TestRun_${runId}_Report.xlsx"`,
    );
    res.end(buffer);
  }
}
