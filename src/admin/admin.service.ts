import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, CreatorLevel, CREATOR_LEVEL_CONFIG } from '../users/schemas/user.schema';
import { Character } from '../characters/schemas/character.schema';
import { Payment, PaymentStatus } from '../payment/schemas/payment.schema';
import { Chat } from '../chat/schemas/chat.schema';
import { Report, ReportStatus } from './schemas/report.schema';
import { Announcement } from './schemas/announcement.schema';
import { Coupon, CouponUsage } from './schemas/coupon.schema';
import { Settlement, SettlementStatus, CreatorEarning } from './schemas/settlement.schema';
import { FAQ } from './schemas/faq.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Character.name) private characterModel: Model<Character>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(Announcement.name) private announcementModel: Model<Announcement>,
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    @InjectModel(CouponUsage.name) private couponUsageModel: Model<CouponUsage>,
    @InjectModel(Settlement.name) private settlementModel: Model<Settlement>,
    @InjectModel(CreatorEarning.name) private creatorEarningModel: Model<CreatorEarning>,
    @InjectModel(FAQ.name) private faqModel: Model<FAQ>,
  ) {}

  // ==================== 대시보드 ====================

  async getDashboardStats(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const totalUsers = await this.userModel.countDocuments();
    const totalCharacters = await this.characterModel.countDocuments();
    const totalChats = await this.chatModel.countDocuments();

    const newUsers30d = await this.userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    const newUsers7d = await this.userModel.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    const newUsersToday = await this.userModel.countDocuments({
      createdAt: { $gte: oneDayAgo },
    });

    const activeSubscribers = await this.userModel.countDocuments({
      isSubscribed: true,
      subscriptionEndDate: { $gte: now },
    });

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

    const totalConversations = await this.chatModel.aggregate([
      { $unwind: '$messages' },
      { $count: 'total' },
    ]);

    const conversations30d = await this.chatModel.aggregate([
      { $match: { lastActivity: { $gte: thirtyDaysAgo } } },
      { $unwind: '$messages' },
      { $count: 'total' },
    ]);

    // 신고 통계
    const pendingReports = await this.reportModel.countDocuments({ status: ReportStatus.PENDING });

    // 정산 대기 통계
    const pendingSettlements = await this.settlementModel.countDocuments({ status: SettlementStatus.PENDING });

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
      pendingReports,
      pendingSettlements,
    };
  }

  // ==================== 통계 차트 ====================

  async getChartStats(days: number = 30): Promise<any> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 일별 가입자 수
    const dailyUsers = await this.userModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 일별 매출
    const dailyRevenue = await this.paymentModel.aggregate([
      { $match: { status: PaymentStatus.COMPLETED, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 일별 캐릭터 생성
    const dailyCharacters = await this.characterModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 일별 채팅 수
    const dailyChats = await this.chatModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      dailyUsers,
      dailyRevenue,
      dailyCharacters,
      dailyChats,
    };
  }

  // ==================== 사용자 관리 ====================

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

  // ==================== 캐릭터 관리 ====================

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

  // ==================== 결제 관리 ====================

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

  async refundPayment(paymentId: string, reason: string): Promise<any> {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('결제를 찾을 수 없습니다.');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('완료된 결제만 환불할 수 있습니다.');
    }

    payment.status = PaymentStatus.REFUNDED;
    (payment as any).refundReason = reason;
    (payment as any).refundedAt = new Date();
    await payment.save();

    return {
      success: true,
      message: '환불이 처리되었습니다.',
      payment,
    };
  }

  async getTopCharacters(): Promise<any> {
    return this.characterModel
      .find({ isPublic: true })
      .populate('creator', 'username')
      .sort({ usageCount: -1 })
      .limit(10)
      .exec();
  }

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

  // ==================== 크리에이터 파트너 관리 ====================

  async getCreators(page: number = 1, limit: number = 20, level?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {
      createdCharacters: { $exists: true, $ne: [] },
    };

    if (level) {
      query.creatorLevel = level;
    }

    const creators = await this.userModel
      .find(query)
      .select('username email profileImage creatorLevel totalConversations createdCharacters createdAt')
      .populate('createdCharacters', 'name usageCount likes')
      .sort({ totalConversations: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.userModel.countDocuments(query);

    const levelStats = await this.userModel.aggregate([
      { $match: { createdCharacters: { $exists: true, $ne: [] } } },
      { $group: { _id: '$creatorLevel', count: { $sum: 1 } } },
    ]);

    const statsMap: Record<string, number> = {};
    levelStats.forEach((stat) => {
      statsMap[stat._id] = stat.count;
    });

    return {
      creators: creators.map((creator) => ({
        ...creator.toObject(),
        levelConfig: CREATOR_LEVEL_CONFIG[creator.creatorLevel] || CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL1],
        characterCount: creator.createdCharacters?.length || 0,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      levelStats: {
        level1: statsMap[CreatorLevel.LEVEL1] || 0,
        level2: statsMap[CreatorLevel.LEVEL2] || 0,
        level3: statsMap[CreatorLevel.LEVEL3] || 0,
        partner: statsMap[CreatorLevel.PARTNER] || 0,
      },
    };
  }

  async setPartnerLevel(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const previousLevel = user.creatorLevel;
    user.creatorLevel = CreatorLevel.PARTNER;
    await user.save();

    return {
      success: true,
      message: `${user.username}님이 공식 파트너로 승격되었습니다.`,
      previousLevel,
      newLevel: CreatorLevel.PARTNER,
      levelConfig: CREATOR_LEVEL_CONFIG[CreatorLevel.PARTNER],
    };
  }

  async removePartnerLevel(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.creatorLevel !== CreatorLevel.PARTNER) {
      return {
        success: false,
        message: '해당 사용자는 파트너가 아닙니다.',
      };
    }

    let newLevel = CreatorLevel.LEVEL1;
    if (user.totalConversations >= CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL3].requiredConversations) {
      newLevel = CreatorLevel.LEVEL3;
    } else if (user.totalConversations >= CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL2].requiredConversations) {
      newLevel = CreatorLevel.LEVEL2;
    }

    user.creatorLevel = newLevel;
    await user.save();

    return {
      success: true,
      message: `${user.username}님의 파트너 자격이 해제되었습니다.`,
      previousLevel: CreatorLevel.PARTNER,
      newLevel,
      levelConfig: CREATOR_LEVEL_CONFIG[newLevel],
    };
  }

  // ==================== 신고 관리 ====================

  async getReports(page: number = 1, limit: number = 20, status?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (status) {
      query.status = status;
    }

    const reports = await this.reportModel
      .find(query)
      .populate('reporter', 'username email')
      .populate('targetId')
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.reportModel.countDocuments(query);

    const statusStats = await this.reportModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return {
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statusStats: statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    };
  }

  async updateReportStatus(reportId: string, status: ReportStatus, adminNote?: string, adminId?: string): Promise<any> {
    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundException('신고를 찾을 수 없습니다.');
    }

    report.status = status;
    if (adminNote) {
      report.adminNote = adminNote;
    }
    if (status === ReportStatus.RESOLVED || status === ReportStatus.REJECTED) {
      report.resolvedAt = new Date();
      if (adminId) {
        report.resolvedBy = adminId as any;
      }
    }

    await report.save();

    return {
      success: true,
      message: '신고 상태가 업데이트되었습니다.',
      report,
    };
  }

  // ==================== 공지사항 관리 ====================

  async getAnnouncements(page: number = 1, limit: number = 20, isActive?: boolean): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const announcements = await this.announcementModel
      .find(query)
      .populate('createdBy', 'username')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.announcementModel.countDocuments(query);

    return {
      announcements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createAnnouncement(data: Partial<Announcement>, adminId: string): Promise<any> {
    const announcement = new this.announcementModel({
      ...data,
      createdBy: adminId,
    });

    await announcement.save();

    return {
      success: true,
      message: '공지사항이 등록되었습니다.',
      announcement,
    };
  }

  async updateAnnouncement(id: string, data: Partial<Announcement>): Promise<any> {
    const announcement = await this.announcementModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );

    if (!announcement) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    return {
      success: true,
      message: '공지사항이 수정되었습니다.',
      announcement,
    };
  }

  async deleteAnnouncement(id: string): Promise<any> {
    const result = await this.announcementModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    return {
      success: true,
      message: '공지사항이 삭제되었습니다.',
    };
  }

  // ==================== 쿠폰 관리 ====================

  async getCoupons(page: number = 1, limit: number = 20, isActive?: boolean): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const coupons = await this.couponModel
      .find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.couponModel.countDocuments(query);

    return {
      coupons,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createCoupon(data: Partial<Coupon>, adminId: string): Promise<any> {
    // 쿠폰 코드 중복 체크
    const existing = await this.couponModel.findOne({ code: data.code });
    if (existing) {
      throw new BadRequestException('이미 존재하는 쿠폰 코드입니다.');
    }

    const coupon = new this.couponModel({
      ...data,
      createdBy: adminId,
    });

    await coupon.save();

    return {
      success: true,
      message: '쿠폰이 생성되었습니다.',
      coupon,
    };
  }

  async updateCoupon(id: string, data: Partial<Coupon>): Promise<any> {
    const coupon = await this.couponModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );

    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    return {
      success: true,
      message: '쿠폰이 수정되었습니다.',
      coupon,
    };
  }

  async deleteCoupon(id: string): Promise<any> {
    const result = await this.couponModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    return {
      success: true,
      message: '쿠폰이 삭제되었습니다.',
    };
  }

  async getCouponUsageStats(couponId: string): Promise<any> {
    const coupon = await this.couponModel.findById(couponId);
    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    const usages = await this.couponUsageModel
      .find({ coupon: couponId })
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .exec();

    return {
      coupon,
      usages,
      totalUsed: usages.length,
    };
  }

  // ==================== 정산 관리 ====================

  async getSettlements(page: number = 1, limit: number = 20, status?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (status) {
      query.status = status;
    }

    const settlements = await this.settlementModel
      .find(query)
      .populate('creator', 'username email profileImage creatorLevel')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.settlementModel.countDocuments(query);

    // 상태별 통계
    const statusStats = await this.settlementModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]);

    return {
      settlements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statusStats: statusStats.reduce((acc, s) => ({
        ...acc,
        [s._id]: { count: s.count, totalAmount: s.totalAmount }
      }), {}),
    };
  }

  async processSettlement(settlementId: string, status: SettlementStatus, adminId: string, adminNote?: string, transactionId?: string): Promise<any> {
    const settlement = await this.settlementModel.findById(settlementId);
    if (!settlement) {
      throw new NotFoundException('정산을 찾을 수 없습니다.');
    }

    settlement.status = status;
    settlement.processedBy = adminId as any;
    settlement.processedAt = new Date();

    if (adminNote) {
      settlement.adminNote = adminNote;
    }
    if (transactionId) {
      settlement.transactionId = transactionId;
    }

    await settlement.save();

    // 정산 완료 시 해당 수익 내역들을 정산 완료로 표시
    if (status === SettlementStatus.COMPLETED) {
      await this.creatorEarningModel.updateMany(
        {
          creator: settlement.creator,
          isSettled: false,
          createdAt: { $gte: settlement.periodStart, $lte: settlement.periodEnd }
        },
        { $set: { isSettled: true, settlement: settlement._id } }
      );
    }

    return {
      success: true,
      message: `정산이 ${status === SettlementStatus.COMPLETED ? '완료' : '처리'}되었습니다.`,
      settlement,
    };
  }

  async getCreatorEarnings(creatorId: string, page: number = 1, limit: number = 50): Promise<any> {
    const skip = (page - 1) * limit;

    const earnings = await this.creatorEarningModel
      .find({ creator: creatorId })
      .populate('character', 'name')
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.creatorEarningModel.countDocuments({ creator: creatorId });

    // 총 수익
    const totalEarnings = await this.creatorEarningModel.aggregate([
      { $match: { creator: creatorId as any } },
      { $group: { _id: null, total: { $sum: '$tokensEarned' } } },
    ]);

    // 미정산 수익
    const unsettledEarnings = await this.creatorEarningModel.aggregate([
      { $match: { creator: creatorId as any, isSettled: false } },
      { $group: { _id: null, total: { $sum: '$tokensEarned' } } },
    ]);

    return {
      earnings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      totalEarnings: totalEarnings[0]?.total || 0,
      unsettledEarnings: unsettledEarnings[0]?.total || 0,
    };
  }

  // ==================== FAQ 관리 ====================

  async getFAQs(page: number = 1, limit: number = 50, category?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (category) {
      query.category = category;
    }

    const faqs = await this.faqModel
      .find(query)
      .populate('createdBy', 'username')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.faqModel.countDocuments(query);

    return {
      faqs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createFAQ(data: Partial<FAQ>, adminId: string): Promise<any> {
    const faq = new this.faqModel({
      ...data,
      createdBy: adminId,
    });

    await faq.save();

    return {
      success: true,
      message: 'FAQ가 등록되었습니다.',
      faq,
    };
  }

  async updateFAQ(id: string, data: Partial<FAQ>, adminId: string): Promise<any> {
    const faq = await this.faqModel.findByIdAndUpdate(
      id,
      { $set: { ...data, updatedBy: adminId } },
      { new: true }
    );

    if (!faq) {
      throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    }

    return {
      success: true,
      message: 'FAQ가 수정되었습니다.',
      faq,
    };
  }

  async deleteFAQ(id: string): Promise<any> {
    const result = await this.faqModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    }

    return {
      success: true,
      message: 'FAQ가 삭제되었습니다.',
    };
  }

  async reorderFAQs(orders: { id: string; order: number }[]): Promise<any> {
    const bulkOps = orders.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order } },
      },
    }));

    await this.faqModel.bulkWrite(bulkOps);

    return {
      success: true,
      message: 'FAQ 순서가 변경되었습니다.',
    };
  }
}
