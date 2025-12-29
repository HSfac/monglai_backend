import { Controller, Get, Post, Put, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ReportStatus } from './schemas/report.schema';
import { SettlementStatus } from './schemas/settlement.schema';

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

  // ==================== 대시보드 ====================

  @Get('dashboard/stats')
  @ApiOperation({ summary: '대시보드 통계 조회' })
  @ApiResponse({ status: 200, description: '통계 조회 성공' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('charts')
  @ApiOperation({ summary: '차트 통계 조회' })
  @ApiResponse({ status: 200, description: '차트 통계 조회 성공' })
  async getChartStats(@Query('days') days: number = 30) {
    return this.adminService.getChartStats(Number(days));
  }

  // ==================== 사용자 관리 ====================

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

  // ==================== 캐릭터 관리 ====================

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

  @Get('characters/top')
  @ApiOperation({ summary: '인기 캐릭터 TOP 10' })
  @ApiResponse({ status: 200, description: '인기 캐릭터 조회 성공' })
  async getTopCharacters() {
    return this.adminService.getTopCharacters();
  }

  // ==================== 결제 관리 ====================

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

  @Put('payments/:id/refund')
  @ApiOperation({ summary: '결제 환불' })
  @ApiResponse({ status: 200, description: '환불 처리 성공' })
  async refundPayment(@Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.refundPayment(id, reason);
  }

  @Get('activities/recent')
  @ApiOperation({ summary: '최근 활동 로그' })
  @ApiResponse({ status: 200, description: '최근 활동 조회 성공' })
  async getRecentActivities(@Query('limit') limit: number = 20) {
    return this.adminService.getRecentActivities(Number(limit));
  }

  // ==================== 크리에이터 파트너 관리 ====================

  @Get('creators')
  @ApiOperation({ summary: '크리에이터 목록 조회' })
  @ApiResponse({ status: 200, description: '크리에이터 목록 조회 성공' })
  async getCreators(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('level') level?: string,
  ) {
    return this.adminService.getCreators(Number(page), Number(limit), level);
  }

  @Put('users/:id/partner')
  @ApiOperation({ summary: '파트너 승격' })
  @ApiResponse({ status: 200, description: '파트너 승격 성공' })
  async setPartner(@Param('id') id: string) {
    return this.adminService.setPartnerLevel(id);
  }

  @Put('users/:id/partner/remove')
  @ApiOperation({ summary: '파트너 해제' })
  @ApiResponse({ status: 200, description: '파트너 해제 성공' })
  async removePartner(@Param('id') id: string) {
    return this.adminService.removePartnerLevel(id);
  }

  // ==================== 신고 관리 ====================

  @Get('reports')
  @ApiOperation({ summary: '신고 목록 조회' })
  @ApiResponse({ status: 200, description: '신고 목록 조회 성공' })
  async getReports(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.getReports(Number(page), Number(limit), status);
  }

  @Put('reports/:id/status')
  @ApiOperation({ summary: '신고 상태 변경' })
  @ApiResponse({ status: 200, description: '신고 상태 변경 성공' })
  async updateReportStatus(
    @Param('id') id: string,
    @Body('status') status: ReportStatus,
    @Body('adminNote') adminNote?: string,
  ) {
    return this.adminService.updateReportStatus(id, status, adminNote);
  }

  // ==================== 공지사항 관리 ====================

  @Get('announcements')
  @ApiOperation({ summary: '공지사항 목록 조회' })
  @ApiResponse({ status: 200, description: '공지사항 목록 조회 성공' })
  async getAnnouncements(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.adminService.getAnnouncements(Number(page), Number(limit), active);
  }

  @Post('announcements')
  @ApiOperation({ summary: '공지사항 등록' })
  @ApiResponse({ status: 201, description: '공지사항 등록 성공' })
  async createAnnouncement(@Body() data: any) {
    return this.adminService.createAnnouncement(data, 'admin');
  }

  @Put('announcements/:id')
  @ApiOperation({ summary: '공지사항 수정' })
  @ApiResponse({ status: 200, description: '공지사항 수정 성공' })
  async updateAnnouncement(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateAnnouncement(id, data);
  }

  @Delete('announcements/:id')
  @ApiOperation({ summary: '공지사항 삭제' })
  @ApiResponse({ status: 200, description: '공지사항 삭제 성공' })
  async deleteAnnouncement(@Param('id') id: string) {
    return this.adminService.deleteAnnouncement(id);
  }

  // ==================== 쿠폰 관리 ====================

  @Get('coupons')
  @ApiOperation({ summary: '쿠폰 목록 조회' })
  @ApiResponse({ status: 200, description: '쿠폰 목록 조회 성공' })
  async getCoupons(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.adminService.getCoupons(Number(page), Number(limit), active);
  }

  @Post('coupons')
  @ApiOperation({ summary: '쿠폰 생성' })
  @ApiResponse({ status: 201, description: '쿠폰 생성 성공' })
  async createCoupon(@Body() data: any) {
    return this.adminService.createCoupon(data, 'admin');
  }

  @Put('coupons/:id')
  @ApiOperation({ summary: '쿠폰 수정' })
  @ApiResponse({ status: 200, description: '쿠폰 수정 성공' })
  async updateCoupon(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateCoupon(id, data);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: '쿠폰 삭제' })
  @ApiResponse({ status: 200, description: '쿠폰 삭제 성공' })
  async deleteCoupon(@Param('id') id: string) {
    return this.adminService.deleteCoupon(id);
  }

  @Get('coupons/:id/usage')
  @ApiOperation({ summary: '쿠폰 사용 내역 조회' })
  @ApiResponse({ status: 200, description: '쿠폰 사용 내역 조회 성공' })
  async getCouponUsageStats(@Param('id') id: string) {
    return this.adminService.getCouponUsageStats(id);
  }

  // ==================== 정산 관리 ====================

  @Get('settlements')
  @ApiOperation({ summary: '정산 목록 조회' })
  @ApiResponse({ status: 200, description: '정산 목록 조회 성공' })
  async getSettlements(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.getSettlements(Number(page), Number(limit), status);
  }

  @Put('settlements/:id/process')
  @ApiOperation({ summary: '정산 처리' })
  @ApiResponse({ status: 200, description: '정산 처리 성공' })
  async processSettlement(
    @Param('id') id: string,
    @Body('status') status: SettlementStatus,
    @Body('adminNote') adminNote?: string,
    @Body('transactionId') transactionId?: string,
  ) {
    return this.adminService.processSettlement(id, status, 'admin', adminNote, transactionId);
  }

  @Get('creators/:id/earnings')
  @ApiOperation({ summary: '크리에이터 수익 내역 조회' })
  @ApiResponse({ status: 200, description: '크리에이터 수익 내역 조회 성공' })
  async getCreatorEarnings(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.adminService.getCreatorEarnings(id, Number(page), Number(limit));
  }

  // ==================== FAQ 관리 ====================

  @Get('faqs')
  @ApiOperation({ summary: 'FAQ 목록 조회' })
  @ApiResponse({ status: 200, description: 'FAQ 목록 조회 성공' })
  async getFAQs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('category') category?: string,
  ) {
    return this.adminService.getFAQs(Number(page), Number(limit), category);
  }

  @Post('faqs')
  @ApiOperation({ summary: 'FAQ 등록' })
  @ApiResponse({ status: 201, description: 'FAQ 등록 성공' })
  async createFAQ(@Body() data: any) {
    return this.adminService.createFAQ(data, 'admin');
  }

  @Put('faqs/:id')
  @ApiOperation({ summary: 'FAQ 수정' })
  @ApiResponse({ status: 200, description: 'FAQ 수정 성공' })
  async updateFAQ(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateFAQ(id, data, 'admin');
  }

  @Delete('faqs/:id')
  @ApiOperation({ summary: 'FAQ 삭제' })
  @ApiResponse({ status: 200, description: 'FAQ 삭제 성공' })
  async deleteFAQ(@Param('id') id: string) {
    return this.adminService.deleteFAQ(id);
  }

  @Put('faqs/reorder')
  @ApiOperation({ summary: 'FAQ 순서 변경' })
  @ApiResponse({ status: 200, description: 'FAQ 순서 변경 성공' })
  async reorderFAQs(@Body('orders') orders: { id: string; order: number }[]) {
    return this.adminService.reorderFAQs(orders);
  }
}
