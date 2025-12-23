import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemorySummary, MemorySummarySchema } from './schemas/memory-summary.schema';
import { UserNote, UserNoteSchema } from './schemas/user-note.schema';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemorySummary.name, schema: MemorySummarySchema },
      { name: UserNote.name, schema: UserNoteSchema },
    ]),
  ],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
