import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Character } from '../characters/schemas/character.schema';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Character.name) private characterModel: Model<Character>,
  ) {}

  /**
   * 매일 자정에 오래된 알림 삭제 (30일 이상)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deleteOldNotifications() {
    this.logger.log('오래된 알림 삭제 작업 시작');
    try {
      await this.notificationsService.deleteOldNotifications(30);
      this.logger.log('오래된 알림 삭제 완료');
    } catch (error) {
      this.logger.error('오래된 알림 삭제 실패', error);
    }
  }

  /**
   * 매일 오전 10시에 구독 만료 임박 알림 (3일 전)
   */
  @Cron('0 10 * * *')
  async notifySubscriptionExpiring() {
    this.logger.log('구독 만료 임박 알림 작업 시작');
    try {
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      const users = await this.userModel.find({
        'subscription.isActive': true,
        'subscription.endDate': {
          $gte: new Date(),
          $lte: threeDaysLater,
        },
      });

      for (const user of users) {
        const daysLeft = Math.ceil(
          ((user as any).subscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        );
        await this.notificationsService.notifySubscriptionExpiring(String(user._id), daysLeft);
      }

      this.logger.log(`구독 만료 임박 알림 ${users.length}건 발송 완료`);
    } catch (error) {
      this.logger.error('구독 만료 임박 알림 실패', error);
    }
  }

  /**
   * 매시간 토큰 부족 사용자 체크 (10개 미만)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async notifyLowTokens() {
    this.logger.log('토큰 부족 알림 작업 시작');
    try {
      const users = await this.userModel.find({
        tokens: { $lt: 10, $gt: 0 },
        'subscription.isActive': false, // 구독자는 제외
      });

      for (const user of users) {
        // 최근 24시간 내에 이미 알림을 받았는지 체크 (중복 방지)
        const recentNotification = await this.notificationsService['notificationModel']
          .findOne({
            userId: user._id,
            title: '토큰 부족',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          });

        if (!recentNotification) {
          await this.notificationsService.notifyLowTokens(String(user._id), user.tokens);
        }
      }

      this.logger.log(`토큰 부족 알림 체크 완료`);
    } catch (error) {
      this.logger.error('토큰 부족 알림 실패', error);
    }
  }

  /**
   * 매일 자정에 인기 캐릭터 순위 갱신 및 알림 (Top 10)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updatePopularCharactersAndNotify() {
    this.logger.log('인기 캐릭터 순위 갱신 및 알림 작업 시작');
    try {
      // 최근 7일간 대화 수 기준으로 인기 캐릭터 조회
      const popularCharacters = await this.characterModel
        .find({ isPublic: true, isDeleted: { $ne: true } })
        .sort({ conversationCount: -1, likeCount: -1 })
        .limit(10)
        .populate('creatorId', '_id');

      for (let i = 0; i < popularCharacters.length; i++) {
        const character = popularCharacters[i];
        const rank = i + 1;

        // 크리에이터에게 알림
        if (character.creator) {
          await this.notificationsService.notifyCharacterPopular(
            character.creator.toString(),
            character.name,
            rank,
          );
        }
      }

      this.logger.log(`인기 캐릭터 ${popularCharacters.length}개 알림 발송 완료`);
    } catch (error) {
      this.logger.error('인기 캐릭터 알림 실패', error);
    }
  }

  /**
   * 매월 1일 오전 10시에 월간 보너스 지급 및 알림
   */
  @Cron('0 10 1 * *')
  async distributeMonthlyBonus() {
    this.logger.log('월간 보너스 지급 작업 시작');
    try {
      // 지난달 인기 캐릭터 Top 10 크리에이터에게 보너스 지급
      const topCharacters = await this.characterModel
        .find({ isPublic: true, isDeleted: { $ne: true } })
        .sort({ conversationCount: -1, likeCount: -1 })
        .limit(10)
        .populate('creator', '_id');

      const bonusTokens = [1000, 750, 500, 400, 300, 250, 200, 150, 100, 50];

      for (let i = 0; i < topCharacters.length; i++) {
        const character = topCharacters[i];
        const rank = i + 1;
        const bonus = bonusTokens[i];

        if (character.creator) {
          // 크리에이터에게 보너스 토큰 지급
          await this.userModel.findByIdAndUpdate(character.creator, {
            $inc: { tokens: bonus },
          });

          // 알림 발송
          await this.notificationsService.notifyMonthlyBonus(
            character.creator.toString(),
            bonus,
            rank,
          );
        }
      }

      this.logger.log(`월간 보너스 ${topCharacters.length}건 지급 완료`);
    } catch (error) {
      this.logger.error('월간 보너스 지급 실패', error);
    }
  }
}
