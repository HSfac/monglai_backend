import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './banner.schema';

@Injectable()
export class BannerService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
  ) {}

  async findAll(): Promise<Banner[]> {
    return this.bannerModel.find().sort({ order: 1, createdAt: -1 }).exec();
  }

  async findActive(): Promise<Banner[]> {
    const now = new Date();
    return this.bannerModel
      .find({
        isActive: true,
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } },
        ],
        $and: [
          {
            $or: [
              { endDate: { $exists: false } },
              { endDate: { $gte: now } },
            ],
          },
        ],
      })
      .sort({ order: 1 })
      .exec();
  }

  async create(createBannerDto: any): Promise<Banner> {
    const banner = new this.bannerModel(createBannerDto);
    return banner.save();
  }

  async update(id: string, updateBannerDto: any): Promise<Banner | null> {
    return this.bannerModel
      .findByIdAndUpdate(id, updateBannerDto, { new: true })
      .exec();
  }

  async delete(id: string): Promise<Banner | null> {
    return this.bannerModel.findByIdAndDelete(id).exec();
  }
}
