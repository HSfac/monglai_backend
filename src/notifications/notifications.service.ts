import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationType } from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
    link?: string,
  ): Promise<Notification> {
    const newNotification = new this.notificationModel({
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
    });

    const savedNotification = await newNotification.save();

    // WebSocket으로 실시간 알림 전송
    if (this.notificationsGateway) {
      await this.notificationsGateway.sendNotificationToUser(userId, savedNotification);
    }

    return savedNotification;
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUserPaginated(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments({ userId }),
    ]);

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(id: string): Promise<Notification | null> {
    return this.notificationModel
      .findByIdAndUpdate(id, { isRead: true }, { new: true })
      .exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ userId, isRead: false }, { isRead: true })
      .exec();
  }

  async deleteOldNotifications(days: number = 30): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    await this.notificationModel.deleteMany({ createdAt: { $lt: date } }).exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ userId, isRead: false });
  }

  async delete(id: string): Promise<void> {
    await this.notificationModel.findByIdAndDelete(id).exec();
  }

  async deleteAll(userId: string): Promise<void> {
    await this.notificationModel.deleteMany({ userId }).exec();
  }

  // ==================== 자동 알림 생성 메서드 ====================

  /**
   * 토큰 충전 완료 알림
   */
  async notifyTokenPurchase(userId: string, tokens: number): Promise<void> {
    await this.create(
      userId,
      '토큰 충전 완료',
      `${tokens}개의 토큰이 충전되었습니다.`,
      NotificationType.SUCCESS,
      '/profile',
    );
  }

  /**
   * 구독 시작 알림
   */
  async notifySubscriptionStart(userId: string, planName: string): Promise<void> {
    await this.create(
      userId,
      '구독 시작',
      `${planName} 구독이 시작되었습니다. 이제 무제한으로 대화를 즐기세요!`,
      NotificationType.SUCCESS,
      '/profile',
    );
  }

  /**
   * 구독 만료 임박 알림 (3일 전)
   */
  async notifySubscriptionExpiring(userId: string, daysLeft: number): Promise<void> {
    await this.create(
      userId,
      '구독 만료 임박',
      `구독이 ${daysLeft}일 후 만료됩니다. 구독을 연장하시겠어요?`,
      NotificationType.WARNING,
      '/pricing',
    );
  }

  /**
   * 크리에이터 레벨업 알림
   */
  async notifyCreatorLevelUp(userId: string, newLevel: string): Promise<void> {
    await this.create(
      userId,
      '크리에이터 레벨업!',
      `축하합니다! ${newLevel} 크리에이터가 되었습니다.`,
      NotificationType.SUCCESS,
      '/characters/creator/dashboard',
    );
  }

  /**
   * 캐릭터 인기 진입 알림
   */
  async notifyCharacterPopular(userId: string, characterName: string, rank: number): Promise<void> {
    await this.create(
      userId,
      '캐릭터 인기 순위 진입!',
      `'${characterName}' 캐릭터가 인기 순위 ${rank}위에 진입했습니다!`,
      NotificationType.SUCCESS,
      '/characters/creator/dashboard',
    );
  }

  /**
   * 월간 보너스 지급 알림
   */
  async notifyMonthlyBonus(userId: string, bonusTokens: number, rank: number): Promise<void> {
    await this.create(
      userId,
      '월간 보너스 지급',
      `이번 달 ${rank}위로 ${bonusTokens}개의 보너스 토큰을 받았습니다!`,
      NotificationType.SUCCESS,
      '/characters/creator/earnings',
    );
  }

  /**
   * 캐릭터 검증 완료 알림
   */
  async notifyCharacterVerified(userId: string, characterName: string): Promise<void> {
    await this.create(
      userId,
      '캐릭터 검증 완료',
      `'${characterName}' 캐릭터가 관리자에 의해 검증되었습니다.`,
      NotificationType.SUCCESS,
      '/characters/creator/dashboard',
    );
  }

  /**
   * 토큰 부족 경고
   */
  async notifyLowTokens(userId: string, remainingTokens: number): Promise<void> {
    await this.create(
      userId,
      '토큰 부족',
      `토큰이 ${remainingTokens}개 남았습니다. 토큰을 충전하거나 구독을 신청하세요.`,
      NotificationType.WARNING,
      '/pricing',
    );
  }
} 