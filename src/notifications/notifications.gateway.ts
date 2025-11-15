import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.userId || payload.sub;

      if (!userId) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.disconnect();
        return;
      }

      // 소켓에 userId 저장
      client.data.userId = userId;

      // 사용자별 소켓 목록 관리
      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

      // 연결 시 읽지 않은 알림 개수 전송
      const unreadCount = await this.notificationsService.getUnreadCount(userId);
      client.emit('unreadCount', { count: unreadCount });
    } catch (error) {
      this.logger.error('Connection authentication failed:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      const filteredSockets = sockets.filter((socketId) => socketId !== client.id);

      if (filteredSockets.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, filteredSockets);
      }
    }

    this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(client: Socket, data: { page?: number; limit?: number }) {
    const userId = client.data.userId;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const { page = 1, limit = 20 } = data;
    const result = await this.notificationsService.findByUserPaginated(userId, page, limit);

    return result;
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: Socket, notificationId: string) {
    const userId = client.data.userId;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    await this.notificationsService.markAsRead(notificationId);

    // 읽지 않은 개수 업데이트
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    client.emit('unreadCount', { count: unreadCount });

    return { success: true };
  }

  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    await this.notificationsService.markAllAsRead(userId);

    client.emit('unreadCount', { count: 0 });

    return { success: true };
  }

  /**
   * 특정 사용자에게 실시간 알림 전송
   */
  async sendNotificationToUser(userId: string, notification: any) {
    const socketIds = this.userSockets.get(userId);

    if (socketIds && socketIds.length > 0) {
      // 해당 사용자의 모든 연결된 소켓에 알림 전송
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit('newNotification', notification);
      });

      // 읽지 않은 개수 업데이트
      const unreadCount = await this.notificationsService.getUnreadCount(userId);
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit('unreadCount', { count: unreadCount });
      });

      this.logger.log(`Notification sent to user ${userId} (${socketIds.length} connections)`);
    }
  }

  /**
   * 여러 사용자에게 알림 전송
   */
  async sendNotificationToUsers(userIds: string[], notification: any) {
    for (const userId of userIds) {
      await this.sendNotificationToUser(userId, notification);
    }
  }
}
