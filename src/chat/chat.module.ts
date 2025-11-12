import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CharactersModule } from '../characters/characters.module';
import { UsersModule } from '../users/users.module';
import { AIService } from './ai.service';
import { ContentFilterService } from './content-filter.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
    CharactersModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, AIService, ContentFilterService],
  exports: [ChatService],
})
export class ChatModule {} 