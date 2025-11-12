import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Character } from '../characters/schemas/character.schema';
import { Payment, PaymentStatus } from '../payment/schemas/payment.schema';
import { Chat } from '../chat/schemas/chat.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Character.name) private characterModel: Model<Character>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
  ) {}

  /**
   * 대시보드 통계 조회
   */
  async getDashboardStats(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 전체 통계
    const totalUsers = await this.userModel.countDocuments();
    const totalCharacters = await this.characterModel.countDocuments();
    const totalChats = await this.chatModel.countDocuments();

    // 신규 가입자 (최근 30일)
    const newUsers30d = await this.userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // 신규 가입자 (최근 7일)
    const newUsers7d = await this.userModel.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    // 신규 가입자 (오늘)
    const newUsersToday = await this.userModel.countDocuments({
      createdAt: { $gte: oneDayAgo },
    });

    // 구독자 수
    const activeSubscribers = await this.userModel.countDocuments({
      isSubscribed: true,
      subscriptionEndDate: { $gte: now },
    });

    // 매출 통계
    const totalRevenue = await this.paymentModel.aggregate([
      { $match: { status: PaymentStatus.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const revenue30d = await this.paymentModel.aggregate([
      {
        $match: {
          status: PaymentStatus.COMPLETED,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const revenueToday = await this.paymentModel.aggregate([
      {
        $match: {
          status: PaymentStatus.COMPLETED,
          createdAt: { $gte: oneDayAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // 대화 통계
    const totalConversations = await this.chatModel.aggregate([
      { $unwind: '$messages' },
      { $count: 'total' },
    ]);

    const conversations30d = await this.chatModel.aggregate([
      { $match: { lastActivity: { $gte: thirtyDaysAgo } } },
      { $unwind: '$messages' },
      { $count: 'total' },
    ]);

    return {
      users: {
        total: totalUsers,
        new30d: newUsers30d,
        new7d: newUsers7d,
        newToday: newUsersToday,
        activeSubscribers,
      },
      characters: {
        total: totalCharacters,
      },
      conversations: {
        total: totalConversations[0]?.total || 0,
        last30d: conversations30d[0]?.total || 0,
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        last30d: revenue30d[0]?.total || 0,
        today: revenueToday[0]?.total || 0,
      },
      chats: {
        total: totalChats,
      },
    };
  }

  /**
   * 사용자 목록 조회 (페이징)
   */
  async getUsers(page: number = 1, limit: number = 20, search?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await this.userModel
      .find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.userModel.countDocuments(query);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 사용자 상세 조회
   */
  async getUserDetail(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .populate('createdCharacters')
      .populate('favoriteCharacters')
      .exec();

    const payments = await this.paymentModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    const chats = await this.chatModel
      .find({ user: userId })
      .populate('character', 'name profileImage')
      .sort({ lastActivity: -1 })
      .limit(10)
      .exec();

    return {
      user,
      recentPayments: payments,
      recentChats: chats,
    };
  }

  /**
   * 사용자 차단/해제
   */
  async toggleUserBlock(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    user.isVerified = !user.isVerified;
    await user.save();

    return {
      success: true,
      isVerified: user.isVerified,
    };
  }

  /**
   * 캐릭터 목록 조회 (페이징)
   */
  async getCharacters(page: number = 1, limit: number = 20, search?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const characters = await this.characterModel
      .find(query)
      .populate('creator', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.characterModel.countDocuments(query);

    return {
      characters,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 캐릭터 검증/해제
   */
  async toggleCharacterVerify(characterId: string): Promise<any> {
    const character = await this.characterModel.findById(characterId);
    if (!character) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }

    character.isVerified = !character.isVerified;
    await character.save();

    return {
      success: true,
      isVerified: character.isVerified,
    };
  }

  /**
   * 캐릭터 공개/비공개
   */
  async toggleCharacterPublic(characterId: string): Promise<any> {
    const character = await this.characterModel.findById(characterId);
    if (!character) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }

    character.isPublic = !character.isPublic;
    await character.save();

    return {
      success: true,
      isPublic: character.isPublic,
    };
  }

  /**
   * 결제 내역 조회 (페이징)
   */
  async getPayments(page: number = 1, limit: number = 50): Promise<any> {
    const skip = (page - 1) * limit;

    const payments = await this.paymentModel
      .find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.paymentModel.countDocuments();

    return {
      payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 매출 통계 (일별, 월별)
   */
  async getRevenueStats(period: 'daily' | 'monthly' = 'daily'): Promise<any> {
    const groupFormat = period === 'daily' ? '%Y-%m-%d' : '%Y-%m';

    const stats = await this.paymentModel.aggregate([
      { $match: { status: PaymentStatus.COMPLETED } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: period === 'daily' ? 30 : 12 },
    ]);

    return {
      period,
      stats,
    };
  }

  /**
   * 인기 캐릭터 TOP 10
   */
  async getTopCharacters(): Promise<any> {
    return this.characterModel
      .find({ isPublic: true })
      .populate('creator', 'username')
      .sort({ usageCount: -1 })
      .limit(10)
      .exec();
  }

  /**
   * 최근 활동 로그
   */
  async getRecentActivities(limit: number = 20): Promise<any> {
    const recentUsers = await this.userModel
      .find()
      .select('username email createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    const recentCharacters = await this.characterModel
      .find()
      .populate('creator', 'username')
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    const recentPayments = await this.paymentModel
      .find({ status: PaymentStatus.COMPLETED })
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    return {
      recentUsers,
      recentCharacters,
      recentPayments,
    };
  }
}
