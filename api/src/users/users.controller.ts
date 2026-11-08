import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { SystemRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ─── PROFILE & PASSWORD (SELF) ──────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Lấy thông tin profile của bản thân' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật thông tin profile của bản thân' })
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu tài khoản' })
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.sub, dto);
  }

  // ─── SEARCH CANDIDATES (FOR PROJECT MEMBER ASSIGNMENT) ───────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm người dùng theo tên hoặc email (cho ô chọn thành viên)' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Từ khóa tìm kiếm' })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'ID dự án để loại trừ người đã vào' })
  searchCandidates(@Query('q') q?: string, @Query('projectId') projectId?: string) {
    return this.usersService.searchCandidates(q ?? '', projectId);
  }

  // ─── SYSTEM ADMIN LEVEL MANAGEMENT ──────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách người dùng hệ thống (có tìm kiếm, lọc, phân trang)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: SystemRole })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: SystemRole,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Tạo người dùng mới' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: '[Admin] Lấy chi tiết user theo ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin/vai trò/trạng thái người dùng' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ADMIN)
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: '[Admin] Xóa người dùng (không được tự xóa bản thân)' })
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.delete(id, user.sub);
  }
}
