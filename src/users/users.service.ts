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

  async findByEmail(email: string): Promise<User> {
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
    if (!user.createdCharacters.includes(characterId)) {
      user.createdCharacters.push(characterId);
    }
    return user.save();
  }

  async addCharacterToFavorites(userId: string, characterId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user.favoriteCharacters.includes(characterId)) {
      user.favoriteCharacters.push(characterId);
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
} 