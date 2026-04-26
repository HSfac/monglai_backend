import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns welcome message', () => {
    expect(appController.getHello()).toBe(
      '몽글AI API 서버에 오신 것을 환영합니다!',
    );
  });

  it('returns health payload', () => {
    const result = appController.healthCheck();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });
});
