import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Character, CharacterSchema } from './schemas/character.schema';
import { Chat, ChatSchema } from '../chat/schemas/chat.schema';
import {
  CreatorEarnings,
  CreatorEarningsSchema,
} from './schemas/creator-earnings.schema';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Character.name, schema: CharacterSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: CreatorEarnings.name, schema: CreatorEarningsSchema },
    ]),
    UsersModule,
    forwardRef(() => ChatModule),
    NotificationsModule,
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
