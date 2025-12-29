import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, CreatorLevel, CREATOR_LEVEL_CONFIG } from './schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

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
    if (user.totalConversations >= CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL3].requiredConversations) {
      user.creatorLevel = CreatorLevel.LEVEL3;
    }
    // Level 2: 대화 1,000회 이상
    else if (user.totalConversations >= CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL2].requiredConversations) {
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
      if (user.totalConversations >= CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL3].requiredConversations) {
        user.creatorLevel = CreatorLevel.LEVEL3;
      } else if (user.totalConversations >= CREATOR_LEVEL_CONFIG[CreatorLevel.LEVEL2].requiredConversations) {
        user.creatorLevel = CreatorLevel.LEVEL2;
      } else {
        user.creatorLevel = CreatorLevel.LEVEL1;
      }
    }

    return user.save();
  }

  async addCharacterToCreated(userId: string, characterId: string): Promise<User> {
    const user = await this.findById(userId);
    const charId = characterId as any;
    if (!user.createdCharacters.includes(charId)) {
      user.createdCharacters.push(charId);
    }
    return user.save();
  }

  async addCharacterToFavorites(userId: string, characterId: string): Promise<User> {
    const user = await this.findById(userId);
    const charId = characterId as any;
    if (!user.favoriteCharacters.includes(charId)) {
      user.favoriteCharacters.push(charId);
    }
    return user.save();
  }

  async removeCharacterFromFavorites(userId: string, characterId: string): Promise<User> {
    const user = await this.findById(userId);
    user.favoriteCharacters = user.favoriteCharacters.filter(
      id => id.toString() !== characterId,
    );
    return user.save();
  }

  async findByProviderId(provider: string, providerId: string): Promise<User | null> {
    return this.userModel.findOne({
      [`socialProviders.${provider}`]: providerId
    }).exec();
  }

  async createSocialUser(
    email: string,
    username: string,
    provider: string,
    providerId: string,
    profileImage?: string
  ): Promise<User> {
    const newUser = new this.userModel({
      email,
      username,
      profileImage,
      tokens: 10, // 신규 가입 보너스 토큰
      isSocialLogin: true,
      socialProviders: {
        [provider]: providerId
      }
    });

    return newUser.save();
  }

  async linkSocialProvider(
    userId: string,
    provider: string,
    providerId: string
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user.socialProviders) {
      user.socialProviders = {};
    }
    user.socialProviders[provider] = providerId;
    return user.save();
  }

  /**
   * 성인인증 처리
   * @param userId 사용자 ID
   * @param verificationToken 인증 토큰 (실제로는 Pass/NICE 같은 본인인증 서비스 연동 필요)
   */
  async verifyAdult(userId: string, verificationToken: string): Promise<any> {
    const user = await this.findById(userId);

    // TODO: 실제 본인인증 API와 연동하여 성인 여부 확인
    // 현재는 간단한 토큰 검증만 수행
    if (!verificationToken || verificationToken.length < 10) {
      throw new BadRequestException('유효하지 않은 인증 토큰입니다.');
    }

    user.isAdultVerified = true;
    user.adultVerifiedAt = new Date();
    await user.save();

    return {
      success: true,
      message: '성인인증이 완료되었습니다.',
      isAdultVerified: true,
      adultVerifiedAt: user.adultVerifiedAt,
    };
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
} 