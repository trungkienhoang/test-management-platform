import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/member.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // ─── PROJECTS ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Tạo dự án mới (người tạo tự động thành QA Lead)' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.projectsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách dự án (Admin: tất cả; User: chỉ dự án của mình)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.findAll(user, Number(page ?? 1), Number(limit ?? 20));
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiOperation({ summary: 'Chi tiết dự án' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật dự án (QA Lead / Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa dự án (Người tạo / Admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.remove(id, user);
  }

  // ─── MEMBERS ────────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'Danh sách thành viên dự án' })
  getMembers(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.getMembers(id, user);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Thêm thành viên vào dự án (QA Lead / Admin)' })
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.addMember(id, dto, user);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Thay đổi vai trò thành viên (QA Lead / Admin)' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.updateMemberRole(id, userId, dto, user);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa thành viên khỏi dự án (QA Lead / Admin)' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.removeMember(id, userId, user);
  }
}
