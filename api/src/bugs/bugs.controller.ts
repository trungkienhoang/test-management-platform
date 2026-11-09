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
import { BugsService } from './bugs.service.js';
import { CreateBugDto } from './dto/create-bug.dto.js';
import { UpdateBugDto } from './dto/update-bug.dto.js';
import { QueryBugDto } from './dto/query-bug.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Bugs & Defects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/bugs')
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo báo cáo lỗi mới (Bug/Defect)' })
  @ApiParam({ name: 'projectId' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBugDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bugsService.create(projectId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách lỗi kèm bộ lọc và phân trang' })
  @ApiParam({ name: 'projectId' })
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryBugDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bugsService.findAll(projectId, user, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng hợp số lượng lỗi theo trạng thái và mức độ nghiêm trọng' })
  @ApiParam({ name: 'projectId' })
  getSummary(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bugsService.getSummary(projectId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết lỗi kèm liên kết 2 chiều với Test Case và Test Execution' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id', description: 'Bug ID' })
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bugsService.findOne(projectId, id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin, trạng thái vòng đời lỗi hoặc phân công người sửa' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id', description: 'Bug ID' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBugDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bugsService.update(projectId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa báo cáo lỗi (chỉ dành cho QA Lead và Admin)' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id', description: 'Bug ID' })
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bugsService.remove(projectId, id, user);
  }
}
