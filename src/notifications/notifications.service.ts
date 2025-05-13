import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
  ) {}

  async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
    link?: string,
  ): Promise<Notification> {
    const newNotification = new this.notificationModel({
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
    });
    
    return newNotification.save();
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.notificationModel
      .findByIdAndUpdate(id, { isRead: true }, { new: true })
      .exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ userId, isRead: false }, { isRead: true })
      .exec();
  }

  async deleteOldNotifications(days: number = 30): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    await this.notificationModel
      .deleteMany({ createdAt: { $lt: date } })
      .exec();
  }
} 