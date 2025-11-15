import { Controller, Get, Patch, Param, UseGuards, Request, Delete, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('알림')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 알림 목록 조회 (페이지네이션)' })
  @ApiResponse({ status: 200, description: '알림 목록 조회 성공' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 개수 (기본값: 20)' })
  async getNotifications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.notificationsService.findByUserPaginated(req.user.userId, pageNum, limitNum);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiBearerAuth()
  @ApiOperation({ summary: '읽지 않은 알림 개수 조회' })
  @ApiResponse({ status: 200, description: '읽지 않은 알림 개수 조회 성공' })
  async getUnreadCount(@Request() req) {
    const count = await this.notificationsService.getUnreadCount(req.user.userId);
    return { count };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '알림 읽음 표시' })
  @ApiResponse({ status: 200, description: '알림 읽음 표시 성공' })
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: '모든 알림 읽음 표시' })
  @ApiResponse({ status: 200, description: '모든 알림 읽음 표시 성공' })
  async markAllAsRead(@Request() req) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { message: '모든 알림이 읽음으로 표시되었습니다.' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '알림 삭제' })
  @ApiResponse({ status: 200, description: '알림 삭제 성공' })
  async deleteNotification(@Param('id') id: string) {
    await this.notificationsService.delete(id);
    return { message: '알림이 삭제되었습니다.' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @ApiBearerAuth()
  @ApiOperation({ summary: '모든 알림 삭제' })
  @ApiResponse({ status: 200, description: '모든 알림 삭제 성공' })
  async deleteAllNotifications(@Request() req) {
    await this.notificationsService.deleteAll(req.user.userId);
    return { message: '모든 알림이 삭제되었습니다.' };
  }
} 