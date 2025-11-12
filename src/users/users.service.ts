import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, CreatorLevel } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
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
    
    // 크리에이터 레벨 업데이트 로직
    if (user.popularCharacters >= 5 && user.totalConversations >= 10000) {
      user.creatorLevel = CreatorLevel.LEVEL3;
    } else if (user.popularCharacters >= 1 && user.totalConversations >= 1000) {
      user.creatorLevel = CreatorLevel.LEVEL2;
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

  async createSocialUser(email: string, username: string, profileImage?: string): Promise<User> {
    const newUser = new this.userModel({
      email,
      username,
      profileImage,
      tokens: 10, // 신규 가입 보너스 토큰
      isSocialLogin: true,
    });

    return newUser.save();
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