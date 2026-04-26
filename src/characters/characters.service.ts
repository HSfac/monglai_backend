import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Character,
  AIModel,
  Visibility,
} from './schemas/character.schema';
import { UsersService } from '../users/users.service';
import {
  CreatorLevel,
  CREATOR_LEVEL_CONFIG,
} from '../users/schemas/user.schema';
import { CreatorEarnings } from './schemas/creator-earnings.schema';
import { Chat } from '../chat/schemas/chat.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CharactersService {
  private readonly creatorSummaryFields = 'username profileImage creatorLevel';

  constructor(
    @InjectModel(Character.name) private characterModel: Model<Character>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(CreatorEarnings.name)
    private creatorEarningsModel: Model<CreatorEarnings>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  private withCreatorSummary<T>(query: T): T {
    return (query as any).populate('creator', this.creatorSummaryFields);
  }

  async create(userId: string, createCharacterDto: any): Promise<Character> {
    // 사용자 조회
    const user = await this.usersService.findById(userId);
    const normalizedVisibility =
      createCharacterDto.visibility ||
      (createCharacterDto.isPublic === false
        ? Visibility.PRIVATE
        : Visibility.PUBLIC);
    const normalizedIsPublic =
      typeof createCharacterDto.isPublic === 'boolean'
        ? createCharacterDto.isPublic
        : normalizedVisibility === Visibility.PUBLIC;

    // 성인 컨텐츠 캐릭터 생성 시 성인 인증 확인
    if (createCharacterDto.isAdultContent && !user.isAdultVerified) {
      throw new ForbiddenException(
        '성인 컨텐츠 캐릭터를 생성하려면 성인 인증이 필요합니다.',
      );
    }

    // 크리에이터 레벨에 따른 캐릭터 생성 제한 확인
    const createdCharactersCount = await this.characterModel.countDocuments({
      creator: userId,
    });
    const levelConfig =
      CREATOR_LEVEL_CONFIG[user.creatorLevel] ||
      CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL1];

    if (createdCharactersCount >= levelConfig.maxCharacters) {
      const levelLabel = levelConfig.label;
      throw new ForbiddenException(
        `${levelLabel} 크리에이터는 최대 ${levelConfig.maxCharacters}개의 캐릭터만 생성할 수 있습니다. ` +
          `더 많은 캐릭터를 만들려면 레벨을 올려주세요.`,
      );
    }

    // worldId 빈 문자열이면 제거 (ObjectId 캐스팅 오류 방지)
    if (createCharacterDto.worldId === '') {
      delete (createCharacterDto as any).worldId;
    }

    // 캐릭터 생성
    const newCharacter = new this.characterModel({
      ...createCharacterDto,
      visibility: normalizedVisibility,
      isPublic: normalizedIsPublic,
      creator: userId,
    });

    const savedCharacter = await newCharacter.save();

    // 사용자의 생성 캐릭터 목록에 추가
    await this.usersService.addCharacterToCreated(
      userId,
      String(savedCharacter._id),
    );

    if (savedCharacter.isPublic) {
      const followerIds = await this.usersService.getFollowerIdsForCreator(userId);
      await Promise.all(
        followerIds.map((followerId) =>
          this.notificationsService.notifyCreatorPublishedCharacter(
            followerId,
            user.username,
            String(savedCharacter._id),
            savedCharacter.name,
          ),
        ),
      );
    }

    return savedCharacter;
  }

  async findAll(filter: any = {}): Promise<Character[]> {
    return this.withCreatorSummary(
      this.characterModel.find({ ...filter, isPublic: true }),
    ).exec();
  }

  async findById(id: string): Promise<Character> {
    const character = await this.characterModel.findById(id).exec();
    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }
    return character;
  }

  async findPublicById(id: string): Promise<Character> {
    const character = await this.withCreatorSummary(
      this.characterModel.findById(id),
    ).exec();

    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }

    return character;
  }

  async findByCreator(creatorId: string): Promise<Character[]> {
    return this.characterModel.find({ creator: creatorId }).exec();
  }

  async findPublicByCreator(creatorId: string): Promise<Character[]> {
    return this.withCreatorSummary(
      this.characterModel
        .find({ creator: creatorId, isPublic: true })
        .sort({ isVerified: -1, usageCount: -1, likes: -1, createdAt: -1 }),
    ).exec();
  }

  async getFollowingFeed(userId: string, limit: number = 6): Promise<Character[]> {
    const user = await this.usersService.findById(userId);
    const followingCreatorIds = (user.followingCreators || []).map((id) =>
      new Types.ObjectId(id.toString()),
    );

    if (followingCreatorIds.length === 0) {
      return [];
    }

    return this.withCreatorSummary(
      this.characterModel
        .find({
          creator: { $in: followingCreatorIds },
          isPublic: true,
        })
        .sort({ createdAt: -1, isVerified: -1, usageCount: -1 })
        .limit(limit),
    ).exec();
  }

  async update(
    id: string,
    userId: string,
    updateCharacterDto: any,
  ): Promise<Character> {
    // 캐릭터 조회
    const character = await this.findById(id);

    // 권한 확인
    if (character.creator.toString() !== userId) {
      throw new ForbiddenException('이 캐릭터를 수정할 권한이 없습니다.');
    }

    // 캐릭터 업데이트
    const updatedCharacter = await this.characterModel
      .findByIdAndUpdate(id, updateCharacterDto, { new: true })
      .exec();

    if (!updatedCharacter) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }

    return updatedCharacter;
  }

  async delete(id: string, userId: string): Promise<void> {
    // 캐릭터 조회
    const character = await this.findById(id);

    // 권한 확인
    if (character.creator.toString() !== userId) {
      throw new ForbiddenException('이 캐릭터를 삭제할 권한이 없습니다.');
    }

    // 캐릭터 삭제
    await this.characterModel.findByIdAndDelete(id).exec();
    await this.usersService.removeCharacterFromCreated(userId, id);
  }

  async incrementUsageCount(id: string): Promise<Character> {
    const character = await this.findById(id);
    character.usageCount += 1;
    return character.save();
  }

  async like(id: string): Promise<Character> {
    const character = await this.findById(id);
    character.likes += 1;

    // 인기 캐릭터 기준 (100 좋아요)
    if (character.likes === 100) {
      const user = await this.usersService.findById(
        character.creator.toString(),
      );
      user.popularCharacters += 1;
      await user.save();

      // 크리에이터 레벨 업데이트
      await this.usersService.updateCreatorLevel(character.creator.toString());
    }

    return character.save();
  }

  async getPopular(): Promise<Character[]> {
    return this.withCreatorSummary(
      this.characterModel
        .find({ isPublic: true })
        .sort({ likes: -1 })
        .limit(10),
    ).exec();
  }

  async search(query: string): Promise<Character[]> {
    return this.withCreatorSummary(
      this.characterModel.find({
        isPublic: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      }),
    ).exec();
  }

  /**
   * 태그로 캐릭터 검색
   */
  async searchByTags(tags: string[]): Promise<Character[]> {
    return this.withCreatorSummary(
      this.characterModel
        .find({
          isPublic: true,
          isVerified: true,
          tags: { $in: tags },
        })
        .sort({ usageCount: -1 })
        .limit(50),
    ).exec();
  }

  /**
   * 인기 태그 조회 (캐릭터에서 가장 많이 사용된 태그)
   */
  async getPopularTags(
    limit: number,
  ): Promise<{ tag: string; count: number }[]> {
    const tags = await this.characterModel.aggregate([
      { $match: { isPublic: true, isVerified: true } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { tag: '$_id', count: 1, _id: 0 } },
    ]);

    return tags;
  }

  // ==================== 크리에이터 수익 배분 시스템 ====================

  /**
   * 대화 발생 시 크리에이터 수익 기록
   * @param characterId 캐릭터 ID
   * @param tokenCost 사용된 토큰 비용
   */
  async recordCreatorEarning(
    characterId: string,
    tokenCost: number,
  ): Promise<void> {
    const character = await this.findById(characterId);
    const creator = await this.usersService.findById(
      character.creator.toString(),
    );

    // 크리에이터 레벨에 따른 수익 배분율 적용
    const levelConfig =
      CREATOR_LEVEL_CONFIG[creator.creatorLevel] ||
      CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL1];
    const earningRate = levelConfig.earningRate;
    const tokensEarned = Math.floor(tokenCost * earningRate);

    // 현재 월 기준 (예: "2025-01")
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // 해당 월의 수익 기록 찾기 또는 생성
    let earningRecord = await this.creatorEarningsModel.findOne({
      creator: character.creator,
      character: characterId,
      period: currentPeriod,
    });

    if (earningRecord) {
      earningRecord.conversationCount += 1;
      earningRecord.tokensEarned += tokensEarned;
      await earningRecord.save();
    } else {
      earningRecord = new this.creatorEarningsModel({
        creator: character.creator,
        character: characterId,
        conversationCount: 1,
        tokensEarned,
        period: currentPeriod,
      });
      await earningRecord.save();
    }

    // 캐릭터의 총 수익 업데이트
    character.tokenEarnings += tokensEarned;
    await character.save();
  }

  /**
   * 크리에이터 수익 조회
   * @param creatorId 크리에이터 ID
   * @param period 조회 기간 (옵션)
   */
  async getCreatorEarnings(creatorId: string, period?: string): Promise<any> {
    const query: any = { creator: creatorId };
    if (period) {
      query.period = period;
    }

    const earnings = await this.creatorEarningsModel
      .find(query)
      .populate('character', 'name profileImage')
      .sort({ period: -1 })
      .exec();

    // 총 수익 계산
    const totalEarnings = earnings.reduce(
      (sum, record) => sum + record.tokensEarned,
      0,
    );
    const totalConversations = earnings.reduce(
      (sum, record) => sum + record.conversationCount,
      0,
    );

    return {
      totalEarnings,
      totalConversations,
      earnings,
    };
  }

  async getCreatorAnalytics(creatorId: string): Promise<any> {
    const creatorObjectId = new Types.ObjectId(creatorId);
    const characters = await this.characterModel
      .find({ creator: creatorObjectId })
      .select('_id name profileImage usageCount likes tokenEarnings')
      .lean();
    const characterIds = characters.map((character) => character._id);

    if (characterIds.length === 0) {
      return {
        totalChats: 0,
        uniqueUsers: 0,
        returningUsers: 0,
        returningUserRate: 0,
        shortSessionRate: 0,
        deepSessionRate: 0,
        avgMessagesPerChat: 0,
        avgAiRepliesPerChat: 0,
        avgTokensPerChat: 0,
        avgChatsPerUser: 0,
        activeChats7d: 0,
        newChats7d: 0,
        activeUsers7d: 0,
        characterSummaries: [],
      };
    }

    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [chatMetrics] = await this.chatModel.aggregate([
      {
        $match: {
          character: { $in: characterIds },
        },
      },
      {
        $project: {
          user: 1,
          lastActivity: 1,
          createdAt: 1,
          totalTokensUsed: 1,
          messageCount: { $size: '$messages' },
          shortSessionCount: {
            $cond: [{ $lte: [{ $size: '$messages' }, 3] }, 1, 0],
          },
          deepSessionCount: {
            $cond: [{ $gte: [{ $size: '$messages' }, 10] }, 1, 0],
          },
          aiReplyCount: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'message',
                cond: { $eq: ['$$message.sender', 'ai'] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' },
          totalAiReplies: { $sum: '$aiReplyCount' },
          totalTokensUsed: { $sum: '$totalTokensUsed' },
          shortSessionCount: { $sum: '$shortSessionCount' },
          deepSessionCount: { $sum: '$deepSessionCount' },
          activeChats7d: {
            $sum: {
              $cond: [{ $gte: ['$lastActivity', last7d] }, 1, 0],
            },
          },
          newChats7d: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', last7d] }, 1, 0],
            },
          },
        },
      },
    ]);

    const characterChatMetrics = await this.chatModel.aggregate([
      {
        $match: {
          character: { $in: characterIds },
        },
      },
      {
        $project: {
          character: 1,
          lastActivity: 1,
          createdAt: 1,
          totalTokensUsed: 1,
          messageCount: { $size: '$messages' },
          aiReplyCount: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'message',
                cond: { $eq: ['$$message.sender', 'ai'] },
              },
            },
          },
          shortSessionCount: {
            $cond: [{ $lte: [{ $size: '$messages' }, 3] }, 1, 0],
          },
          deepSessionCount: {
            $cond: [{ $gte: [{ $size: '$messages' }, 10] }, 1, 0],
          },
        },
      },
      {
        $group: {
          _id: '$character',
          totalChats: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' },
          totalAiReplies: { $sum: '$aiReplyCount' },
          totalTokensUsed: { $sum: '$totalTokensUsed' },
          shortSessionCount: { $sum: '$shortSessionCount' },
          deepSessionCount: { $sum: '$deepSessionCount' },
          activeChats7d: {
            $sum: {
              $cond: [{ $gte: ['$lastActivity', last7d] }, 1, 0],
            },
          },
          newChats7d: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', last7d] }, 1, 0],
            },
          },
        },
      },
    ]);

    const [userMetrics] = await this.chatModel.aggregate([
      {
        $match: {
          character: { $in: characterIds },
        },
      },
      {
        $group: {
          _id: '$user',
          chatCount: { $sum: 1 },
          lastActivity: { $max: '$lastActivity' },
        },
      },
      {
        $group: {
          _id: null,
          uniqueUsers: { $sum: 1 },
          returningUsers: {
            $sum: {
              $cond: [{ $gte: ['$chatCount', 2] }, 1, 0],
            },
          },
          activeUsers7d: {
            $sum: {
              $cond: [{ $gte: ['$lastActivity', last7d] }, 1, 0],
            },
          },
        },
      },
    ]);

    const characterUserMetrics = await this.chatModel.aggregate([
      {
        $match: {
          character: { $in: characterIds },
        },
      },
      {
        $group: {
          _id: {
            character: '$character',
            user: '$user',
          },
          chatCount: { $sum: 1 },
          lastActivity: { $max: '$lastActivity' },
        },
      },
      {
        $group: {
          _id: '$_id.character',
          uniqueUsers: { $sum: 1 },
          returningUsers: {
            $sum: {
              $cond: [{ $gte: ['$chatCount', 2] }, 1, 0],
            },
          },
          activeUsers7d: {
            $sum: {
              $cond: [{ $gte: ['$lastActivity', last7d] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalChats = chatMetrics?.totalChats || 0;
    const uniqueUsers = userMetrics?.uniqueUsers || 0;
    const returningUsers = userMetrics?.returningUsers || 0;
    const characterChatMetricMap = new Map(
      characterChatMetrics.map((metric) => [String(metric._id), metric]),
    );
    const characterUserMetricMap = new Map(
      characterUserMetrics.map((metric) => [String(metric._id), metric]),
    );
    const roundToSingleDecimal = (value: number) =>
      Math.round(value * 10) / 10;
    const characterSummaries = characters.map((character) => {
      const chatMetric = characterChatMetricMap.get(String(character._id));
      const userMetric = characterUserMetricMap.get(String(character._id));
      const characterTotalChats = chatMetric?.totalChats || 0;
      const characterUniqueUsers = userMetric?.uniqueUsers || 0;
      const characterReturningUsers = userMetric?.returningUsers || 0;

      return {
        characterId: String(character._id),
        totalChats: characterTotalChats,
        uniqueUsers: characterUniqueUsers,
        returningUsers: characterReturningUsers,
        returningUserRate:
          characterUniqueUsers > 0
            ? roundToSingleDecimal(
                (characterReturningUsers / characterUniqueUsers) * 100,
              )
            : 0,
        shortSessionRate:
          characterTotalChats > 0
            ? roundToSingleDecimal(
                ((chatMetric?.shortSessionCount || 0) / characterTotalChats) *
                  100,
              )
            : 0,
        deepSessionRate:
          characterTotalChats > 0
            ? roundToSingleDecimal(
                ((chatMetric?.deepSessionCount || 0) / characterTotalChats) *
                  100,
              )
            : 0,
        avgMessagesPerChat:
          characterTotalChats > 0
            ? roundToSingleDecimal(
                (chatMetric?.totalMessages || 0) / characterTotalChats,
              )
            : 0,
        avgAiRepliesPerChat:
          characterTotalChats > 0
            ? roundToSingleDecimal(
                (chatMetric?.totalAiReplies || 0) / characterTotalChats,
              )
            : 0,
        avgTokensPerChat:
          characterTotalChats > 0
            ? roundToSingleDecimal(
                (chatMetric?.totalTokensUsed || 0) / characterTotalChats,
              )
            : 0,
        activeChats7d: chatMetric?.activeChats7d || 0,
        newChats7d: chatMetric?.newChats7d || 0,
        activeUsers7d: userMetric?.activeUsers7d || 0,
      };
    });

    return {
      totalChats,
      uniqueUsers,
      returningUsers,
      returningUserRate:
        uniqueUsers > 0
          ? roundToSingleDecimal((returningUsers / uniqueUsers) * 100)
          : 0,
      shortSessionRate:
        totalChats > 0
          ? roundToSingleDecimal(
              ((chatMetrics?.shortSessionCount || 0) / totalChats) * 100,
            )
          : 0,
      deepSessionRate:
        totalChats > 0
          ? roundToSingleDecimal(
              ((chatMetrics?.deepSessionCount || 0) / totalChats) * 100,
            )
          : 0,
      avgMessagesPerChat:
        totalChats > 0
          ? roundToSingleDecimal((chatMetrics?.totalMessages || 0) / totalChats)
          : 0,
      avgAiRepliesPerChat:
        totalChats > 0
          ? roundToSingleDecimal(
              (chatMetrics?.totalAiReplies || 0) / totalChats,
            )
          : 0,
      avgTokensPerChat:
        totalChats > 0
          ? roundToSingleDecimal(
              (chatMetrics?.totalTokensUsed || 0) / totalChats,
            )
          : 0,
      avgChatsPerUser: uniqueUsers > 0 ? roundToSingleDecimal(totalChats / uniqueUsers) : 0,
      activeChats7d: chatMetrics?.activeChats7d || 0,
      newChats7d: chatMetrics?.newChats7d || 0,
      activeUsers7d: userMetrics?.activeUsers7d || 0,
      characterSummaries,
    };
  }

  /**
   * 월간 인기 캐릭터 Top 10 조회 및 보너스 지급
   */
  async distributeMonthlyBonus(): Promise<any> {
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // 월간 인기 캐릭터 Top 10 조회 (대화 횟수 기준)
    const topCharacters = await this.creatorEarningsModel
      .find({ period: currentPeriod })
      .sort({ conversationCount: -1 })
      .limit(10)
      .populate('character', 'name')
      .populate('creator', 'username email')
      .exec();

    // 보너스 토큰 지급 (1등: 1000, 2등: 500, 3-10등: 100)
    const bonuses = [1000, 500, 100, 100, 100, 100, 100, 100, 100, 100];

    const results: Array<{
      rank: number;
      creator: any;
      character: any;
      conversations: number;
      bonusTokens: number;
    }> = [];

    for (let i = 0; i < topCharacters.length; i++) {
      const record = topCharacters[i];
      const bonusTokens = bonuses[i];

      // 크리에이터에게 보너스 토큰 지급
      const creatorId =
        typeof record.creator === 'object' &&
        record.creator &&
        '_id' in record.creator
          ? (record.creator as any)._id.toString()
          : String(record.creator);
      await this.usersService.addTokens(creatorId, bonusTokens);

      // 수익 기록 업데이트
      record.tokensEarned += bonusTokens;
      await record.save();

      results.push({
        rank: i + 1,
        creator: record.creator,
        character: record.character,
        conversations: record.conversationCount,
        bonusTokens,
      });
    }

    return {
      period: currentPeriod,
      topCharacters: results,
    };
  }

  /**
   * 캐릭터 인기 순위 리더보드
   * @param period 기간 (daily, weekly, monthly, all-time)
   * @param limit 표시 개수
   */
  async getLeaderboard(
    period: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'all-time',
    limit: number = 50,
  ): Promise<any> {
    let characters: any[];

    if (period === 'all-time') {
      // 전체 기간: usageCount + likes 조합 점수
      characters = await this.characterModel
        .find({ isPublic: true, isVerified: true })
        .populate('creator', 'username profileImage')
        .sort({ usageCount: -1, likes: -1 })
        .limit(limit)
        .exec();

      return characters.map((char, index) => ({
        rank: index + 1,
        character: {
          _id: char._id,
          name: char.name,
          description: char.description,
          profileImage: char.profileImage,
          tags: char.tags,
          isAdultContent: char.isAdultContent,
        },
        creator: char.creator,
        stats: {
          usageCount: char.usageCount,
          likes: char.likes,
          totalScore: char.usageCount + char.likes * 10, // 좋아요 가중치 10배
        },
      }));
    } else {
      // 기간별: CreatorEarnings 기반 (대화 횟수)
      const now = new Date();
      let startDate: Date;
      let periodFilter: string;

      if (period === 'daily') {
        // 오늘 (예: "2025-01-11")
        periodFilter = now.toISOString().slice(0, 10);
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        // 최근 7일
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodFilter = now.toISOString().slice(0, 7); // 월 기준으로 필터
      } else {
        // monthly: 이번 달 (예: "2025-01")
        periodFilter = now.toISOString().slice(0, 7);
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // 기간별 집계
      const earnings = await this.creatorEarningsModel
        .find({ period: periodFilter })
        .populate({
          path: 'character',
          select:
            'name description profileImage tags isAdultContent isPublic isVerified creator',
          match: { isPublic: true, isVerified: true },
        })
        .populate('creator', 'username profileImage')
        .sort({ conversationCount: -1 })
        .limit(limit)
        .exec();

      // null 캐릭터 필터링 (비공개/미인증 제외)
      const validEarnings = earnings.filter((e) => e.character != null);

      return validEarnings.map((earning, index) => ({
        rank: index + 1,
        character: {
          _id: (earning.character as any)._id,
          name: (earning.character as any).name,
          description: (earning.character as any).description,
          profileImage: (earning.character as any).profileImage,
          tags: (earning.character as any).tags,
          isAdultContent: (earning.character as any).isAdultContent,
        },
        creator: earning.creator,
        stats: {
          conversationCount: earning.conversationCount,
          tokensEarned: earning.tokensEarned,
        },
        period: earning.period,
      }));
    }
  }
}
