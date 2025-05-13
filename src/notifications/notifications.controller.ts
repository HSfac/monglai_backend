import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('알림')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 알림 목록 조회' })
  @ApiResponse({ status: 200, description: '알림 목록 조회 성공' })
  async getNotifications(@Request() req) {
    return this.notificationsService.findByUser(req.user.userId);
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
} 