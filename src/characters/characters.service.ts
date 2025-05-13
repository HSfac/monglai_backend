import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Character, AIModel } from './schemas/character.schema';
import { UsersService } from '../users/users.service';
import { CreatorLevel } from '../users/schemas/user.schema';

@Injectable()
export class CharactersService {
  constructor(
    @InjectModel(Character.name) private characterModel: Model<Character>,
    private usersService: UsersService,
  ) {}

  async create(userId: string, createCharacterDto: any): Promise<Character> {
    // 사용자 조회
    const user = await this.usersService.findById(userId);
    
    // 크리에이터 레벨에 따른 캐릭터 생성 제한 확인
    const createdCharactersCount = user.createdCharacters.length;
    
    if (
      (user.creatorLevel === CreatorLevel.LEVEL1 && createdCharactersCount >= 1) ||
      (user.creatorLevel === CreatorLevel.LEVEL2 && createdCharactersCount >= 3)
    ) {
      throw new ForbiddenException('크리에이터 레벨에 따른 캐릭터 생성 한도에 도달했습니다.');
    }
    
    // 캐릭터 생성
    const newCharacter = new this.characterModel({
      ...createCharacterDto,
      creator: userId,
    });
    
    const savedCharacter = await newCharacter.save();
    
    // 사용자의 생성 캐릭터 목록에 추가
    await this.usersService.addCharacterToCreated(userId, savedCharacter._id);
    
    return savedCharacter;
  }

  async findAll(filter: any = {}): Promise<Character[]> {
    return this.characterModel.find({ ...filter, isPublic: true }).exec();
  }

  async findById(id: string): Promise<Character> {
    const character = await this.characterModel.findById(id).exec();
    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }
    return character;
  }

  async findByCreator(creatorId: string): Promise<Character[]> {
    return this.characterModel.find({ creator: creatorId }).exec();
  }

  async update(id: string, userId: string, updateCharacterDto: any): Promise<Character> {
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
      const user = await this.usersService.findById(character.creator.toString());
      user.popularCharacters += 1;
      await user.save();
      
      // 크리에이터 레벨 업데이트
      await this.usersService.updateCreatorLevel(character.creator.toString());
    }
    
    return character.save();
  }

  async getPopular(): Promise<Character[]> {
    return this.characterModel
      .find({ isPublic: true })
      .sort({ likes: -1 })
      .limit(10)
      .exec();
  }

  async search(query: string): Promise<Character[]> {
    return this.characterModel
      .find({
        isPublic: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
      .exec();
  }
} 