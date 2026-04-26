import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: {
    create: jest.Mock;
    sendMessage: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    chatService = {
      create: jest.fn(),
      sendMessage: jest.fn(),
      delete: jest.fn(),
    };

    controller = new ChatController(chatService as unknown as ChatService);
  });

  it('creates a chat with the authenticated user and dto options', async () => {
    const req = { user: { userId: 'user-1' } };
    const dto = {
      characterId: 'character-1',
      aiModel: 'gpt-4o-mini',
      presetId: 'preset-1',
      mode: 'roleplay',
      title: '첫 대화',
    };
    const result = { id: 'chat-1' };

    chatService.create.mockResolvedValue(result);

    await expect(controller.create(req, dto as any)).resolves.toEqual(result);

    expect(chatService.create).toHaveBeenCalledWith('user-1', 'character-1', {
      aiModel: 'gpt-4o-mini',
      presetId: 'preset-1',
      mode: 'roleplay',
      title: '첫 대화',
    });
  });

  it('sends a message with the authenticated user id', async () => {
    const req = { user: { userId: 'user-1' } };
    const dto = { content: '안녕' };
    const result = { userMessage: dto.content, assistantMessage: '반가워' };

    chatService.sendMessage.mockResolvedValue(result);

    await expect(
      controller.sendMessage(req, 'chat-1', dto as any),
    ).resolves.toEqual(result);

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      'user-1',
      '안녕',
    );
  });

  it('deletes a chat and returns the fixed response message', async () => {
    const req = { user: { userId: 'user-1' } };
    chatService.delete.mockResolvedValue(undefined);

    await expect(controller.remove(req, 'chat-1')).resolves.toEqual({
      message: '채팅이 삭제되었습니다.',
    });

    expect(chatService.delete).toHaveBeenCalledWith('chat-1', 'user-1');
  });
});
