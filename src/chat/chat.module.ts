import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { SessionState, SessionStateSchema } from './schemas/session-state.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CharactersModule } from '../characters/characters.module';
import { UsersModule } from '../users/users.module';
import { AIService } from './ai.service';
import { ContentFilterService } from './content-filter.service';
import { ContextBuilderService } from './services/context-builder.service';
import { WorldsModule } from '../worlds/worlds.module';
import { PersonaPresetsModule } from '../persona-presets/persona-presets.module';
import { MemoryModule } from '../memory/memory.module';
import { Character, CharacterSchema } from '../characters/schemas/character.schema';
import { World, WorldSchema } from '../worlds/schemas/world.schema';
import { PersonaPreset, PersonaPresetSchema } from '../persona-presets/schemas/persona-preset.schema';
import { MemorySummary, MemorySummarySchema } from '../memory/schemas/memory-summary.schema';
import { UserNote, UserNoteSchema } from '../memory/schemas/user-note.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: SessionState.name, schema: SessionStateSchema },
      { name: Character.name, schema: CharacterSchema },
      { name: World.name, schema: WorldSchema },
      { name: PersonaPreset.name, schema: PersonaPresetSchema },
      { name: MemorySummary.name, schema: MemorySummarySchema },
      { name: UserNote.name, schema: UserNoteSchema },
    ]),
    forwardRef(() => CharactersModule),
    UsersModule,
    WorldsModule,
    PersonaPresetsModule,
    MemoryModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, AIService, ContentFilterService, ContextBuilderService],
  exports: [ChatService, ContextBuilderService, AIService],
})
export class ChatModule {} 