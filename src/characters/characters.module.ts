import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Character, CharacterSchema } from './schemas/character.schema';
import { CreatorEarnings, CreatorEarningsSchema } from './schemas/creator-earnings.schema';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Character.name, schema: CharacterSchema },
      { name: CreatorEarnings.name, schema: CreatorEarningsSchema },
    ]),
    UsersModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {} 