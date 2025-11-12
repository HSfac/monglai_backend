import { Controller, Get, Put, Query, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

@ApiTags('관리자')
@Controller('admin')
@UseGuards(AdminAuthGuard)
@ApiHeader({
  name: 'x-admin-token',
  description: '관리자 인증 토큰',
  required: true,
})
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: '대시보드 통계 조회' })
  @ApiResponse({ status: 200, description: '통계 조회 성공' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: '사용자 목록 조회' })
  @ApiResponse({ status: 200, description: '사용자 목록 조회 성공' })
  async getUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(Number(page), Number(limit), search);
  }

  @Get('users/:id')
  @ApiOperation({ summary: '사용자 상세 조회' })
  @ApiResponse({ status: 200, description: '사용자 상세 조회 성공' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/block')
  @ApiOperation({ summary: '사용자 차단/해제' })
  @ApiResponse({ status: 200, description: '사용자 차단/해제 성공' })
  async toggleUserBlock(@Param('id') id: string) {
    return this.adminService.toggleUserBlock(id);
  }

  @Get('characters')
  @ApiOperation({ summary: '캐릭터 목록 조회' })
  @ApiResponse({ status: 200, description: '캐릭터 목록 조회 성공' })
  async getCharacters(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.getCharacters(Number(page), Number(limit), search);
  }

  @Put('characters/:id/verify')
  @ApiOperation({ summary: '캐릭터 검증/해제' })
  @ApiResponse({ status: 200, description: '캐릭터 검증/해제 성공' })
  async toggleCharacterVerify(@Param('id') id: string) {
    return this.adminService.toggleCharacterVerify(id);
  }

  @Put('characters/:id/public')
  @ApiOperation({ summary: '캐릭터 공개/비공개 전환' })
  @ApiResponse({ status: 200, description: '캐릭터 공개/비공개 전환 성공' })
  async toggleCharacterPublic(@Param('id') id: string) {
    return this.adminService.toggleCharacterPublic(id);
  }

  @Get('payments')
  @ApiOperation({ summary: '결제 내역 조회' })
  @ApiResponse({ status: 200, description: '결제 내역 조회 성공' })
  async getPayments(@Query('page') page: number = 1, @Query('limit') limit: number = 50) {
    return this.adminService.getPayments(Number(page), Number(limit));
  }

  @Get('revenue/stats')
  @ApiOperation({ summary: '매출 통계 조회' })
  @ApiResponse({ status: 200, description: '매출 통계 조회 성공' })
  async getRevenueStats(@Query('period') period: 'daily' | 'monthly' = 'daily') {
    return this.adminService.getRevenueStats(period);
  }

  @Get('characters/top')
  @ApiOperation({ summary: '인기 캐릭터 TOP 10' })
  @ApiResponse({ status: 200, description: '인기 캐릭터 조회 성공' })
  async getTopCharacters() {
    return this.adminService.getTopCharacters();
  }

  @Get('activities/recent')
  @ApiOperation({ summary: '최근 활동 로그' })
  @ApiResponse({ status: 200, description: '최근 활동 조회 성공' })
  async getRecentActivities(@Query('limit') limit: number = 20) {
    return this.adminService.getRecentActivities(Number(limit));
  }
}
