import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { World } from './schemas/world.schema';
import { CreateWorldDto } from './dto/create-world.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { Visibility } from '../characters/schemas/character.schema';

@Injectable()
export class WorldsService {
  constructor(
    @InjectModel(World.name) private worldModel: Model<World>,
  ) {}

  async create(createWorldDto: CreateWorldDto, creatorId: string): Promise<World> {
    const world = new this.worldModel({
      ...createWorldDto,
      creator: new Types.ObjectId(creatorId),
    });
    return world.save();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    tags?: string[];
    search?: string;
    creatorId?: string;
    visibility?: Visibility;
  }): Promise<{ worlds: World[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20, tags, search, creatorId, visibility } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // 공개 범위 필터
    if (visibility) {
      filter.visibility = visibility;
    } else {
      filter.visibility = Visibility.PUBLIC;
    }

    // 태그 필터
    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    // 검색어 필터
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // 특정 제작자 필터
    if (creatorId) {
      filter.creator = new Types.ObjectId(creatorId);
    }

    const [worlds, total] = await Promise.all([
      this.worldModel
        .find(filter)
        .sort({ usageCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('creator', 'username profileImage')
        .exec(),
      this.worldModel.countDocuments(filter),
    ]);

    return {
      worlds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId?: string): Promise<World> {
    const world = await this.worldModel
      .findById(id)
      .populate('creator', 'username profileImage')
      .exec();

    if (!world) {
      throw new NotFoundException('세계관을 찾을 수 없습니다.');
    }

    // 비공개 세계관 접근 제어
    if (world.visibility === Visibility.PRIVATE) {
      const creatorId = (world.creator as any)._id?.toString() || world.creator.toString();
      if (!userId || creatorId !== userId) {
        throw new ForbiddenException('이 세계관에 접근할 권한이 없습니다.');
      }
    }

    return world;
  }

  async findByCreator(creatorId: string): Promise<World[]> {
    return this.worldModel
      .find({ creator: new Types.ObjectId(creatorId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    updateWorldDto: UpdateWorldDto,
    userId: string,
  ): Promise<World> {
    const world = await this.worldModel.findById(id);

    if (!world) {
      throw new NotFoundException('세계관을 찾을 수 없습니다.');
    }

    if (world.creator.toString() !== userId) {
      throw new ForbiddenException('이 세계관을 수정할 권한이 없습니다.');
    }

    Object.assign(world, updateWorldDto);
    return world.save();
  }

  async remove(id: string, userId: string): Promise<void> {
    const world = await this.worldModel.findById(id);

    if (!world) {
      throw new NotFoundException('세계관을 찾을 수 없습니다.');
    }

    if (world.creator.toString() !== userId) {
      throw new ForbiddenException('이 세계관을 삭제할 권한이 없습니다.');
    }

    await this.worldModel.findByIdAndDelete(id);
  }

  async incrementUsageCount(id: string): Promise<void> {
    await this.worldModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
  }

  async incrementCharacterCount(id: string, delta: number = 1): Promise<void> {
    await this.worldModel.findByIdAndUpdate(id, { $inc: { characterCount: delta } });
  }

  async like(id: string): Promise<World> {
    const world = await this.worldModel.findByIdAndUpdate(
      id,
      { $inc: { likes: 1 } },
      { new: true },
    );

    if (!world) {
      throw new NotFoundException('세계관을 찾을 수 없습니다.');
    }

    return world;
  }

  async getPopular(limit: number = 10): Promise<World[]> {
    return this.worldModel
      .find({ visibility: Visibility.PUBLIC })
      .sort({ usageCount: -1, likes: -1 })
      .limit(limit)
      .populate('creator', 'username profileImage')
      .exec();
  }

  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const result = await this.worldModel.aggregate([
      { $match: { visibility: Visibility.PUBLIC } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { tag: '$_id', count: 1, _id: 0 } },
    ]);

    return result;
  }
}
