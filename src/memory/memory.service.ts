import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemorySummary } from './schemas/memory-summary.schema';
import { UserNote, NoteTargetType } from './schemas/user-note.schema';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class MemoryService {
  constructor(
    @InjectModel(MemorySummary.name) private memorySummaryModel: Model<MemorySummary>,
    @InjectModel(UserNote.name) private userNoteModel: Model<UserNote>,
  ) {}

  // ==================== 메모리 요약 관련 ====================

  async createMemorySummary(data: {
    sessionId: string;
    messageRange: { start: number; end: number };
    summaryText: string;
    keyEvents?: string[];
    emotionalTone?: string;
    importantFacts?: string[];
  }): Promise<MemorySummary> {
    const summary = new this.memorySummaryModel({
      sessionId: new Types.ObjectId(data.sessionId),
      messageRange: data.messageRange,
      summaryText: data.summaryText,
      keyEvents: data.keyEvents || [],
      emotionalTone: data.emotionalTone,
      importantFacts: data.importantFacts || [],
    });

    return summary.save();
  }

  async getMemorySummaries(
    sessionId: string,
    limit: number = 5,
  ): Promise<MemorySummary[]> {
    return this.memorySummaryModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getLatestMemorySummary(sessionId: string): Promise<MemorySummary | null> {
    return this.memorySummaryModel
      .findOne({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async deleteMemorySummariesBySession(sessionId: string): Promise<void> {
    await this.memorySummaryModel.deleteMany({
      sessionId: new Types.ObjectId(sessionId),
    });
  }

  // ==================== 유저 노트 관련 ====================

  async createNote(
    createNoteDto: CreateNoteDto,
    userId: string,
  ): Promise<UserNote> {
    const note = new this.userNoteModel({
      ...createNoteDto,
      userId: new Types.ObjectId(userId),
      targetId: new Types.ObjectId(createNoteDto.targetId),
    });

    return note.save();
  }

  async getNotesBySession(sessionId: string, userId: string): Promise<UserNote[]> {
    return this.userNoteModel
      .find({
        userId: new Types.ObjectId(userId),
        targetType: NoteTargetType.SESSION,
        targetId: new Types.ObjectId(sessionId),
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();
  }

  async getNotesByCharacter(characterId: string, userId: string): Promise<UserNote[]> {
    return this.userNoteModel
      .find({
        userId: new Types.ObjectId(userId),
        targetType: NoteTargetType.CHARACTER,
        targetId: new Types.ObjectId(characterId),
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();
  }

  async getNotesForContext(
    sessionId: string,
    characterId: string,
    userId: string,
  ): Promise<UserNote[]> {
    return this.userNoteModel
      .find({
        userId: new Types.ObjectId(userId),
        includeInContext: true,
        $or: [
          { targetType: NoteTargetType.SESSION, targetId: new Types.ObjectId(sessionId) },
          { targetType: NoteTargetType.CHARACTER, targetId: new Types.ObjectId(characterId) },
        ],
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();
  }

  async findNoteById(id: string): Promise<UserNote> {
    const note = await this.userNoteModel.findById(id).exec();

    if (!note) {
      throw new NotFoundException('노트를 찾을 수 없습니다.');
    }

    return note;
  }

  async updateNote(
    id: string,
    updateNoteDto: UpdateNoteDto,
    userId: string,
  ): Promise<UserNote> {
    const note = await this.userNoteModel.findById(id);

    if (!note) {
      throw new NotFoundException('노트를 찾을 수 없습니다.');
    }

    if (note.userId.toString() !== userId) {
      throw new ForbiddenException('이 노트를 수정할 권한이 없습니다.');
    }

    Object.assign(note, updateNoteDto);
    return note.save();
  }

  async deleteNote(id: string, userId: string): Promise<void> {
    const note = await this.userNoteModel.findById(id);

    if (!note) {
      throw new NotFoundException('노트를 찾을 수 없습니다.');
    }

    if (note.userId.toString() !== userId) {
      throw new ForbiddenException('이 노트를 삭제할 권한이 없습니다.');
    }

    await this.userNoteModel.findByIdAndDelete(id);
  }

  async togglePinNote(id: string, userId: string): Promise<UserNote> {
    const note = await this.userNoteModel.findById(id);

    if (!note) {
      throw new NotFoundException('노트를 찾을 수 없습니다.');
    }

    if (note.userId.toString() !== userId) {
      throw new ForbiddenException('이 노트를 수정할 권한이 없습니다.');
    }

    note.isPinned = !note.isPinned;
    return note.save();
  }

  async toggleIncludeInContext(id: string, userId: string): Promise<UserNote> {
    const note = await this.userNoteModel.findById(id);

    if (!note) {
      throw new NotFoundException('노트를 찾을 수 없습니다.');
    }

    if (note.userId.toString() !== userId) {
      throw new ForbiddenException('이 노트를 수정할 권한이 없습니다.');
    }

    note.includeInContext = !note.includeInContext;
    return note.save();
  }

  // ==================== 유틸리티 ====================

  async getMemoryStatsForSession(sessionId: string): Promise<{
    summaryCount: number;
    latestSummaryRange: { start: number; end: number } | null;
  }> {
    const summaries = await this.memorySummaryModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: -1 })
      .exec();

    return {
      summaryCount: summaries.length,
      latestSummaryRange: summaries.length > 0 ? summaries[0].messageRange : null,
    };
  }
}
