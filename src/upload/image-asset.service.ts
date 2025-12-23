import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ImageAsset, ImageAssetType } from './schemas/image-asset.schema';
import { S3Service } from './s3.service';
import { ImageFilterService } from './image-filter.service';

// 이미지 슬롯 제한 설정
export const IMAGE_SLOT_LIMITS = {
  CHARACTER_DEFAULT: 20,    // 캐릭터당 기본 이미지 슬롯
  WORLD_TOTAL: 100,        // 세계관 전체 이미지 슬롯
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
};

export interface ImageSlotUsage {
  characterSlots: {
    used: number;
    total: number;
    remaining: number;
  };
  worldSlots?: {
    used: number;
    total: number;
    remaining: number;
  };
}

export interface CreateImageAssetDto {
  worldId?: string;
  characterId?: string;
  presetId?: string;
  type: ImageAssetType;
  tags?: string[];
  description?: string;
  isAdultContent?: boolean;
}

@Injectable()
export class ImageAssetService {
  constructor(
    @InjectModel(ImageAsset.name) private imageAssetModel: Model<ImageAsset>,
    private s3Service: S3Service,
    private imageFilterService: ImageFilterService,
  ) {}

  /**
   * 이미지 슬롯 사용량 조회
   */
  async getSlotUsage(
    userId: string,
    characterId?: string,
    worldId?: string,
  ): Promise<ImageSlotUsage> {
    const result: ImageSlotUsage = {
      characterSlots: {
        used: 0,
        total: IMAGE_SLOT_LIMITS.CHARACTER_DEFAULT,
        remaining: IMAGE_SLOT_LIMITS.CHARACTER_DEFAULT,
      },
    };

    // 캐릭터별 이미지 수
    if (characterId) {
      const characterCount = await this.imageAssetModel.countDocuments({
        ownerId: new Types.ObjectId(userId),
        characterId: new Types.ObjectId(characterId),
      });
      result.characterSlots.used = characterCount;
      result.characterSlots.remaining = Math.max(
        0,
        IMAGE_SLOT_LIMITS.CHARACTER_DEFAULT - characterCount,
      );
    }

    // 세계관별 이미지 수
    if (worldId) {
      const worldCount = await this.imageAssetModel.countDocuments({
        ownerId: new Types.ObjectId(userId),
        worldId: new Types.ObjectId(worldId),
      });
      result.worldSlots = {
        used: worldCount,
        total: IMAGE_SLOT_LIMITS.WORLD_TOTAL,
        remaining: Math.max(0, IMAGE_SLOT_LIMITS.WORLD_TOTAL - worldCount),
      };
    }

    return result;
  }

  /**
   * 이미지 업로드 및 자산 등록
   */
  async uploadAndCreateAsset(
    file: Express.Multer.File,
    userId: string,
    dto: CreateImageAssetDto,
    isAdultVerified: boolean = false,
  ): Promise<ImageAsset> {
    // 파일 검증
    if (!file) {
      throw new BadRequestException('이미지 파일이 없습니다.');
    }
    if (!file.mimetype.includes('image')) {
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    }
    if (file.size > IMAGE_SLOT_LIMITS.MAX_FILE_SIZE) {
      throw new BadRequestException('파일 크기는 5MB 이하여야 합니다.');
    }

    // 슬롯 제한 체크
    if (dto.characterId) {
      const usage = await this.getSlotUsage(userId, dto.characterId, dto.worldId);
      if (usage.characterSlots.remaining <= 0) {
        throw new BadRequestException(
          `캐릭터당 최대 ${IMAGE_SLOT_LIMITS.CHARACTER_DEFAULT}개의 이미지만 업로드할 수 있습니다.`,
        );
      }
    }
    if (dto.worldId) {
      const usage = await this.getSlotUsage(userId, undefined, dto.worldId);
      if (usage.worldSlots && usage.worldSlots.remaining <= 0) {
        throw new BadRequestException(
          `세계관당 최대 ${IMAGE_SLOT_LIMITS.WORLD_TOTAL}개의 이미지만 업로드할 수 있습니다.`,
        );
      }
    }

    // NSFW 필터링
    try {
      await this.imageFilterService.validateCharacterImage(
        file.buffer,
        dto.isAdultContent || false,
        isAdultVerified,
      );
    } catch (error) {
      throw new BadRequestException(error.message || '부적절한 이미지가 감지되었습니다.');
    }

    // S3 업로드
    const folder = dto.characterId
      ? `characters/${dto.characterId}`
      : dto.worldId
      ? `worlds/${dto.worldId}`
      : 'images';
    const url = await this.s3Service.uploadFile(file, folder);

    // 자산 생성
    const asset = new this.imageAssetModel({
      ownerId: new Types.ObjectId(userId),
      worldId: dto.worldId ? new Types.ObjectId(dto.worldId) : undefined,
      characterId: dto.characterId ? new Types.ObjectId(dto.characterId) : undefined,
      presetId: dto.presetId ? new Types.ObjectId(dto.presetId) : undefined,
      type: dto.type,
      url,
      fileName: file.originalname,
      fileSize: file.size,
      tags: dto.tags || [],
      description: dto.description,
      isAdultContent: dto.isAdultContent || false,
    });

    return asset.save();
  }

  /**
   * 캐릭터의 이미지 자산 목록 조회
   */
  async findByCharacter(characterId: string): Promise<ImageAsset[]> {
    return this.imageAssetModel
      .find({ characterId: new Types.ObjectId(characterId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * 세계관의 이미지 자산 목록 조회
   */
  async findByWorld(worldId: string): Promise<ImageAsset[]> {
    return this.imageAssetModel
      .find({ worldId: new Types.ObjectId(worldId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * 사용자의 이미지 자산 목록 조회
   */
  async findByOwner(
    ownerId: string,
    options?: { type?: ImageAssetType; limit?: number; offset?: number },
  ): Promise<{ assets: ImageAsset[]; total: number }> {
    const query: any = { ownerId: new Types.ObjectId(ownerId) };
    if (options?.type) {
      query.type = options.type;
    }

    const [assets, total] = await Promise.all([
      this.imageAssetModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(options?.offset || 0)
        .limit(options?.limit || 50)
        .exec(),
      this.imageAssetModel.countDocuments(query),
    ]);

    return { assets, total };
  }

  /**
   * 이미지 자산 상세 조회
   */
  async findOne(assetId: string): Promise<ImageAsset> {
    const asset = await this.imageAssetModel.findById(assetId).exec();
    if (!asset) {
      throw new NotFoundException('이미지를 찾을 수 없습니다.');
    }
    return asset;
  }

  /**
   * 이미지 자산 수정
   */
  async update(
    assetId: string,
    userId: string,
    updateDto: { tags?: string[]; description?: string; type?: ImageAssetType },
  ): Promise<ImageAsset> {
    const asset = await this.findOne(assetId);

    if (asset.ownerId.toString() !== userId) {
      throw new ForbiddenException('이 이미지를 수정할 권한이 없습니다.');
    }

    Object.assign(asset, updateDto);
    return asset.save();
  }

  /**
   * 이미지 자산 삭제
   */
  async remove(assetId: string, userId: string): Promise<void> {
    const asset = await this.findOne(assetId);

    if (asset.ownerId.toString() !== userId) {
      throw new ForbiddenException('이 이미지를 삭제할 권한이 없습니다.');
    }

    // S3에서 파일 삭제
    try {
      await this.s3Service.deleteFile(asset.url);
    } catch (error) {
      console.error('S3 파일 삭제 실패:', error);
    }

    // DB에서 삭제
    await this.imageAssetModel.findByIdAndDelete(assetId).exec();
  }

  /**
   * 캐릭터의 모든 이미지 삭제 (캐릭터 삭제 시 호출)
   */
  async removeByCharacter(characterId: string, userId: string): Promise<number> {
    const assets = await this.findByCharacter(characterId);

    // 소유자 확인 및 삭제
    let deletedCount = 0;
    for (const asset of assets) {
      if (asset.ownerId.toString() === userId) {
        try {
          await this.s3Service.deleteFile(asset.url);
        } catch (error) {
          console.error('S3 파일 삭제 실패:', error);
        }
        await this.imageAssetModel.findByIdAndDelete(asset._id).exec();
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 이미지 사용 횟수 증가
   */
  async incrementUsage(assetId: string): Promise<void> {
    await this.imageAssetModel.findByIdAndUpdate(assetId, {
      $inc: { usageCount: 1 },
    });
  }
}
