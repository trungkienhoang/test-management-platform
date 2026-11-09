import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TestRunsService } from './test-runs.service.js';
import { TestExecutionsService } from './test-executions.service.js';
import { CreateTestRunDto } from './dto/create-test-run.dto.js';
import { UpdateTestRunDto } from './dto/update-test-run.dto.js';
import { QueryTestRunDto } from './dto/query-test-run.dto.js';
import { UpdateExecutionDto } from './dto/update-execution.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Test Runs & Executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/test-runs')
export class TestRunsController {
  constructor(
    private readonly testRunsService: TestRunsService,
    private readonly testExecutionsService: TestExecutionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo đợt kiểm thử mới (Test Run) và đóng băng snapshot các Test Case' })
  @ApiParam({ name: 'projectId' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestRunDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testRunsService.create(projectId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách các đợt kiểm thử kèm thống kê tiến độ thực thi' })
  @ApiParam({ name: 'projectId' })
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryTestRunDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testRunsService.findAll(projectId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đợt kiểm thử và danh sách Test Case trong Run' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id', description: 'Test Run ID' })
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testRunsService.findOne(projectId, id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin / trạng thái đợt kiểm thử (QA Lead đóng run)' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id', description: 'Test Run ID' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTestRunDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testRunsService.update(projectId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa đợt kiểm thử (chỉ QA Lead)' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id', description: 'Test Run ID' })
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testRunsService.remove(projectId, id, user);
  }

  @Patch(':runId/executions/:executionId')
  @ApiOperation({ summary: 'Cập nhật kết quả thực thi ca test (Pass, Fail, Blocked, Skipped)' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'runId' })
  @ApiParam({ name: 'executionId' })
  updateExecution(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('executionId') executionId: string,
    @Body() dto: UpdateExecutionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testExecutionsService.update(projectId, runId, executionId, dto, user);
  }
}
