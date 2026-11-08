import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import { TestCasesService } from './test-cases.service.js';
import { CreateTestCaseDto } from './dto/create-test-case.dto.js';
import { UpdateTestCaseDto } from './dto/update-test-case.dto.js';
import { QueryTestCaseDto } from './dto/query-test-case.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Test Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/test-cases')
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo Test Case mới' })
  @ApiResponse({ status: 201, description: 'Test Case được tạo thành công' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestCaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.create(projectId, dto, user);
  }

  @Get('export')
  @ApiOperation({ summary: 'Xuất danh sách Test Case ra file Excel (.xlsx) hoặc CSV' })
  async export(
    @Param('projectId') projectId: string,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const validFormat = format === 'csv' ? 'csv' : 'xlsx';
    const { buffer, filename, contentType } = await this.testCasesService.exportTestCases(
      projectId,
      validFormat,
      user,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Nhập Test Case từ tệp Excel hoặc CSV' })
  import(
    @Param('projectId') projectId: string,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn một tệp Excel (.xlsx) hoặc CSV để tải lên');
    }
    return this.testCasesService.importTestCases(projectId, file.buffer, user);
  }

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm, lọc và phân trang danh sách Test Cases' })
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryTestCaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.findAll(projectId, query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết Test Case' })
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.findOne(projectId, id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật Test Case (tự động tạo phiên bản lịch sử mới)' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTestCaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.update(projectId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa Test Case (QA Lead / Admin)' })
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.remove(projectId, id, user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Xem lịch sử các phiên bản thay đổi của Test Case' })
  findHistories(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.findHistories(projectId, id, user);
  }

  @Get(':id/history/:version')
  @ApiOperation({ summary: 'Xem chi tiết một phiên bản snapshot cụ thể của Test Case' })
  findHistoryVersion(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCasesService.findHistoryVersion(projectId, id, parseInt(version, 10), user);
  }
}
