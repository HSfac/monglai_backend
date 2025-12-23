import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PersonaPreset } from './schemas/persona-preset.schema';
import { CreatePresetDto } from './dto/create-preset.dto';
import { UpdatePresetDto } from './dto/update-preset.dto';

@Injectable()
export class PersonaPresetsService {
  constructor(
    @InjectModel(PersonaPreset.name) private presetModel: Model<PersonaPreset>,
  ) {}

  async create(
    characterId: string,
    createPresetDto: CreatePresetDto,
    creatorId: string,
  ): Promise<PersonaPreset> {
    // 기본 프리셋 설정 시 기존 기본 프리셋 해제
    if (createPresetDto.isDefault) {
      await this.presetModel.updateMany(
        { characterId: new Types.ObjectId(characterId), isDefault: true },
        { isDefault: false },
      );
    }

    const preset = new this.presetModel({
      ...createPresetDto,
      characterId: new Types.ObjectId(characterId),
      creator: new Types.ObjectId(creatorId),
    });

    return preset.save();
  }

  async findByCharacter(characterId: string): Promise<PersonaPreset[]> {
    return this.presetModel
      .find({ characterId: new Types.ObjectId(characterId) })
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<PersonaPreset> {
    const preset = await this.presetModel.findById(id).exec();

    if (!preset) {
      throw new NotFoundException('프리셋을 찾을 수 없습니다.');
    }

    return preset;
  }

  async findDefaultByCharacter(characterId: string): Promise<PersonaPreset | null> {
    return this.presetModel
      .findOne({
        characterId: new Types.ObjectId(characterId),
        isDefault: true,
      })
      .exec();
  }

  async update(
    id: string,
    updatePresetDto: UpdatePresetDto,
    userId: string,
  ): Promise<PersonaPreset> {
    const preset = await this.presetModel.findById(id);

    if (!preset) {
      throw new NotFoundException('프리셋을 찾을 수 없습니다.');
    }

    if (preset.creator.toString() !== userId) {
      throw new ForbiddenException('이 프리셋을 수정할 권한이 없습니다.');
    }

    // 기본 프리셋 설정 시 기존 기본 프리셋 해제
    if (updatePresetDto.isDefault && !preset.isDefault) {
      await this.presetModel.updateMany(
        { characterId: preset.characterId, isDefault: true },
        { isDefault: false },
      );
    }

    Object.assign(preset, updatePresetDto);
    return preset.save();
  }

  async remove(id: string, userId: string): Promise<void> {
    const preset = await this.presetModel.findById(id);

    if (!preset) {
      throw new NotFoundException('프리셋을 찾을 수 없습니다.');
    }

    if (preset.creator.toString() !== userId) {
      throw new ForbiddenException('이 프리셋을 삭제할 권한이 없습니다.');
    }

    await this.presetModel.findByIdAndDelete(id);
  }

  async setDefault(id: string, userId: string): Promise<PersonaPreset> {
    const preset = await this.presetModel.findById(id);

    if (!preset) {
      throw new NotFoundException('프리셋을 찾을 수 없습니다.');
    }

    if (preset.creator.toString() !== userId) {
      throw new ForbiddenException('이 프리셋을 수정할 권한이 없습니다.');
    }

    // 기존 기본 프리셋 해제
    await this.presetModel.updateMany(
      { characterId: preset.characterId, isDefault: true },
      { isDefault: false },
    );

    // 새 기본 프리셋 설정
    preset.isDefault = true;
    return preset.save();
  }

  async incrementUsageCount(id: string): Promise<void> {
    await this.presetModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
  }

  async duplicatePreset(
    id: string,
    newTitle: string,
    userId: string,
  ): Promise<PersonaPreset> {
    const original = await this.presetModel.findById(id);

    if (!original) {
      throw new NotFoundException('프리셋을 찾을 수 없습니다.');
    }

    const duplicate = new this.presetModel({
      characterId: original.characterId,
      title: newTitle,
      relationshipToUser: original.relationshipToUser,
      mood: original.mood,
      speakingTone: original.speakingTone,
      scenarioIntro: original.scenarioIntro,
      rules: [...original.rules],
      promptOverrides: { ...original.promptOverrides },
      thumbnailImage: original.thumbnailImage,
      isDefault: false,
      creator: new Types.ObjectId(userId),
    });

    return duplicate.save();
  }
}
