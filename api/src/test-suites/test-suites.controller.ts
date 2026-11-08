import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TestSuitesService } from './test-suites.service.js';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto.js';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Test Suites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/suites')
export class TestSuitesController {
  constructor(private readonly testSuitesService: TestSuitesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo Test Suite mới trong dự án' })
  @ApiResponse({ status: 201, description: 'Test Suite được tạo thành công' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestSuiteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testSuitesService.create(projectId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy cây phân cấp Test Suites trong dự án kèm số lượng test cases' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: JwtPayload) {
    return this.testSuitesService.findAll(projectId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một Test Suite' })
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testSuitesService.findOne(projectId, id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật Test Suite' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTestSuiteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testSuitesService.update(projectId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa Test Suite (QA Lead / Admin)' })
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testSuitesService.remove(projectId, id, user);
  }
}
