import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  CreatorLevel,
  CREATOR_LEVEL_CONFIG,
} from './schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Character } from '../characters/schemas/character.schema';

@Injectable()
export class UsersService {
  private readonly creatorLevelOrder = [
    CreatorLevel.LEVEL1,
    CreatorLevel.LEVEL2,
    CreatorLevel.LEVEL3,
    CreatorLevel.PARTNER,
  ];

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Character.name) private characterModel: Model<Character>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  private buildCreatorProgress(
    creatorLevel: CreatorLevel,
    totalConversations: number,
    activeCharacterCount: number,
  ) {
    const currentConfig =
      CREATOR_LEVEL_CONFIG[creatorLevel] ||
      CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL1];
    const currentIndex = this.creatorLevelOrder.indexOf(creatorLevel);
    const nextLevel = this.creatorLevelOrder[currentIndex + 1] || null;
    const maxCharacters = Number.isFinite(currentConfig.maxCharacters)
      ? currentConfig.maxCharacters
      : null;
    const earningRatePercent = Math.round(currentConfig.earningRate * 100);

    if (creatorLevel === CreatorLevel.PARTNER) {
      return {
        currentLevel: creatorLevel,
        currentLabel: currentConfig.label,
        nextLevel: null,
        nextLabel: null,
        nextRequirement: null,
        currentConversations: totalConversations,
        remainingConversations: 0,
        progressPercent: 100,
        earningRatePercent,
        maxCharacters,
        activeCharacterCount,
        remainingCharacterSlots: null,
      };
    }

    if (creatorLevel === CreatorLevel.LEVEL3) {
      return {
        currentLevel: creatorLevel,
        currentLabel: currentConfig.label,
        nextLevel: CreatorLevel.PARTNER,
        nextLabel: CREATOR_LEVEL_CONFIG[CreatorLevel.PARTNER].label,
        nextRequirement: '관리자 승인으로 파트너 승격',
        currentConversations: totalConversations,
        remainingConversations: 0,
        progressPercent: 100,
        earningRatePercent,
        maxCharacters,
        activeCharacterCount,
        remainingCharacterSlots: null,
      };
    }

    const nextConfig =
      nextLevel && CREATOR_LEVEL_CONFIG[nextLevel]
        ? CREATOR_LEVEL_CONFIG[nextLevel]
        : null;
    const currentThreshold = currentConfig.requiredConversations;
    const nextThreshold = nextConfig?.requiredConversations || currentThreshold;
    const stageSpan = Math.max(nextThreshold - currentThreshold, 1);
    const stageProgress = Math.min(
      Math.max(totalConversations - currentThreshold, 0),
      stageSpan,
    );
    const progressPercent = Math.round((stageProgress / stageSpan) * 100);

    return {
      currentLevel: creatorLevel,
      currentLabel: currentConfig.label,
      nextLevel,
      nextLabel: nextConfig?.label || null,
      nextRequirement: nextConfig
        ? `대화 ${nextThreshold.toLocaleString()}회`
        : null,
      currentConversations: totalConversations,
      remainingConversations: Math.max(nextThreshold - totalConversations, 0),
      progressPercent,
      earningRatePercent,
      maxCharacters,
      activeCharacterCount,
      remainingCharacterSlots:
        maxCharacters !== null
          ? Math.max(maxCharacters - activeCharacterCount, 0)
          : null,
    };
  }

  private sanitizeUser(user: User, activeCharacterCount: number) {
    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.billingKey;
    delete safeUser.customerKey;
    delete safeUser.verificationCI;

    return {
      ...safeUser,
      creatorProgress: this.buildCreatorProgress(
        safeUser.creatorLevel,
        safeUser.totalConversations || 0,
        activeCharacterCount,
      ),
    };
  }

  async create(createUserDto: any): Promise<User> {
    const newUser = new this.userModel(createUserDto);
    return newUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`사용자 ID ${id}를 찾을 수 없습니다.`);
    }
    return user;
  }

  async getMeProfile(userId: string) {
    const user = await this.findById(userId);
    const activeCharacterCount = await this.characterModel.countDocuments({
      creator: userId,
    });

    return this.sanitizeUser(user, activeCharacterCount);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async update(id: string, updateUserDto: any): Promise<User> {
    const user = await this.findById(id);

    // 비밀번호는 별도 API로 처리하므로 여기서는 제외
    if (updateUserDto.password) {
      delete updateUserDto.password;
    }

    Object.assign(user, updateUserDto);
    return user.save();
  }

  async delete(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }

  async addTokens(userId: string, amount: number): Promise<User> {
    const user = await this.findById(userId);
    user.tokens += amount;
    return user.save();
  }

  async useTokens(userId: string, amount: number): Promise<User> {
    const user = await this.findById(userId);
    if (user.tokens < amount) {
      throw new BadRequestException('토큰이 부족합니다.');
    }
    user.tokens -= amount;
    return user.save();
  }

  async updateCreatorLevel(userId: string): Promise<User> {
    const user = await this.findById(userId);
    const previousLevel = user.creatorLevel;

    // 파트너는 관리자만 설정 가능하므로 자동 레벨업에서 제외
    if (user.creatorLevel === CreatorLevel.PARTNER) {
      return user;
    }

    // 크리에이터 레벨 업데이트 로직 (대화 횟수 기준)
    // Level 3: 대화 10,000회 이상
    if (
      user.totalConversations >=
      CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL3].requiredConversations
    ) {
      user.creatorLevel = CreatorLevel.LEVEL3;
    }
    // Level 2: 대화 1,000회 이상
    else if (
      user.totalConversations >=
      CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL2].requiredConversations
    ) {
      user.creatorLevel = CreatorLevel.LEVEL2;
    }

    // 레벨이 변경되었으면 알림 전송
    if (previousLevel !== user.creatorLevel) {
      const levelConfig = CREATOR_LEVEL_CONFIG[user.creatorLevel];
      await this.notificationsService.notifyCreatorLevelUp(
        userId,
        levelConfig.label,
      );
    }

    return user.save();
  }

  /**
   * 관리자용: 사용자를 파트너로 승격
   */
  async setPartnerLevel(userId: string): Promise<User> {
    const user = await this.findById(userId);
    const previousLevel = user.creatorLevel;

    user.creatorLevel = CreatorLevel.PARTNER;

    if (previousLevel !== CreatorLevel.PARTNER) {
      await this.notificationsService.notifyCreatorLevelUp(
        userId,
        CREATOR_LEVEL_CONFIG[CreatorLevel.PARTNER].label,
      );
    }

    return user.save();
  }

  /**
   * 관리자용: 파트너 해제
   */
  async removePartnerLevel(userId: string): Promise<User> {
    const user = await this.findById(userId);

    if (user.creatorLevel === CreatorLevel.PARTNER) {
      // 대화 횟수에 따라 적절한 레벨로 복귀
      if (
        user.totalConversations >=
        CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL3].requiredConversations
      ) {
        user.creatorLevel = CreatorLevel.LEVEL3;
      } else if (
        user.totalConversations >=
        CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL2].requiredConversations
      ) {
        user.creatorLevel = CreatorLevel.LEVEL2;
      } else {
        user.creatorLevel = CreatorLevel.LEVEL1;
      }
    }

    return user.save();
  }

  async addCharacterToCreated(
    userId: string,
    characterId: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    const charId = characterId as any;
    if (!user.createdCharacters.includes(charId)) {
      user.createdCharacters.push(charId);
    }
    return user.save();
  }

  async removeCharacterFromCreated(
    userId: string,
    characterId: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    user.createdCharacters = user.createdCharacters.filter(
      (id) => id.toString() !== characterId,
    );
    return user.save();
  }

  async followCreator(userId: string, creatorId: string) {
    if (userId === creatorId) {
      throw new BadRequestException('자신을 팔로우할 수 없습니다.');
    }

    const [user, creator] = await Promise.all([
      this.findById(userId),
      this.userModel.findById(creatorId).select('_id username').exec(),
    ]);

    if (!creator) {
      throw new NotFoundException(`사용자 ID ${creatorId}를 찾을 수 없습니다.`);
    }

    const alreadyFollowing = (user.followingCreators || []).some(
      (id) => id.toString() === creatorId,
    );

    if (!alreadyFollowing) {
      if (!user.followingCreators) {
        user.followingCreators = [];
      }
      user.followingCreators.push(creator._id as any);
      await user.save();
    }

    const followerCount = await this.userModel.countDocuments({
      followingCreators: creator._id,
    });

    return {
      creatorId,
      isFollowing: true,
      followerCount,
    };
  }

  async unfollowCreator(userId: string, creatorId: string) {
    const user = await this.findById(userId);
    user.followingCreators = (user.followingCreators || []).filter(
      (id) => id.toString() !== creatorId,
    );
    await user.save();

    const followerCount = await this.userModel.countDocuments({
      followingCreators: new Types.ObjectId(creatorId),
    });

    return {
      creatorId,
      isFollowing: false,
      followerCount,
    };
  }

  async getFollowerIdsForCreator(creatorId: string): Promise<string[]> {
    const followers = await this.userModel
      .find({ followingCreators: new Types.ObjectId(creatorId) })
      .select('_id')
      .lean();

    return followers.map((follower) => String(follower._id));
  }

  async addCharacterToFavorites(
    userId: string,
    characterId: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    const charId = characterId as any;
    if (!user.favoriteCharacters.includes(charId)) {
      user.favoriteCharacters.push(charId);
    }
    return user.save();
  }

  async removeCharacterFromFavorites(
    userId: string,
    characterId: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    user.favoriteCharacters = user.favoriteCharacters.filter(
      (id) => id.toString() !== characterId,
    );
    return user.save();
  }

  async findByProviderId(
    provider: string,
    providerId: string,
  ): Promise<User | null> {
    return this.userModel
      .findOne({
        [`socialProviders.${provider}`]: providerId,
      })
      .exec();
  }

  async createSocialUser(
    email: string,
    username: string,
    provider: string,
    providerId: string,
    profileImage?: string,
  ): Promise<User> {
    const newUser = new this.userModel({
      email,
      username,
      profileImage,
      tokens: 10, // 신규 가입 보너스 토큰
      isSocialLogin: true,
      socialProviders: {
        [provider]: providerId,
      },
    });

    return newUser.save();
  }

  async linkSocialProvider(
    userId: string,
    provider: string,
    providerId: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user.socialProviders) {
      user.socialProviders = {};
    }
    user.socialProviders[provider] = providerId;
    return user.save();
  }

  /**
   * CI로 사용자 찾기 (중복 인증 방지용)
   */
  async findByCI(ci: string): Promise<User | null> {
    return this.userModel.findOne({ verificationCI: ci }).exec();
  }

  /**
   * 본인인증 정보 업데이트
   */
  async updateAdultVerification(
    userId: string,
    verificationData: {
      isAdultVerified: boolean;
      adultVerifiedAt: Date;
      verificationCI: string;
      verificationName: string;
      verificationBirthDate: string;
    },
  ): Promise<User> {
    const user = await this.findById(userId);

    Object.assign(user, verificationData);
    await user.save();

    return user;
  }

  async getCreatorPublicProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select(
        '_id username profileImage creatorLevel totalConversations popularCharacters createdAt',
      )
      .lean();

    if (!user) {
      throw new NotFoundException(`사용자 ID ${userId}를 찾을 수 없습니다.`);
    }

    const creatorObjectId = new Types.ObjectId(userId);
    const totalCharacterCount = await this.characterModel.countDocuments({
      creator: creatorObjectId,
    });
    const followerCount = await this.userModel.countDocuments({
      followingCreators: creatorObjectId,
    });
    const [publicStats] = await this.characterModel.aggregate([
      {
        $match: {
          creator: creatorObjectId,
          isPublic: true,
        },
      },
      {
        $group: {
          _id: null,
          publicCharacterCount: { $sum: 1 },
          verifiedCharacterCount: {
            $sum: { $cond: ['$isVerified', 1, 0] },
          },
          totalLikes: { $sum: '$likes' },
          totalUsage: { $sum: '$usageCount' },
          totalTokenEarnings: { $sum: '$tokenEarnings' },
        },
      },
    ]);

    return {
      ...user,
      stats: {
        totalCharacterCount,
        publicCharacterCount: publicStats?.publicCharacterCount || 0,
        verifiedCharacterCount: publicStats?.verifiedCharacterCount || 0,
        totalLikes: publicStats?.totalLikes || 0,
        totalUsage: publicStats?.totalUsage || 0,
        totalTokenEarnings: publicStats?.totalTokenEarnings || 0,
        followerCount,
      },
      creatorProgress: this.buildCreatorProgress(
        user.creatorLevel,
        user.totalConversations || 0,
        totalCharacterCount,
      ),
    };
  }
}
