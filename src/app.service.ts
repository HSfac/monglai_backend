import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '몽글AI API 서버에 오신 것을 환영합니다!';
  }
} 