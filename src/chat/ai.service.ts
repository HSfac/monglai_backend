import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModel } from '../characters/schemas/character.schema';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { MistralClient } from '@mistralai/mistralai';

@Injectable()
export class AIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private mistral: MistralClient;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('CLAUDE_API_KEY'),
    });

    this.mistral = new MistralClient(
      this.configService.get<string>('MISTRAL_API_KEY'),
    );
  }

  async generateResponse(
    aiModel: AIModel,
    character: any,
    messages: any[],
    userMessage: string,
  ): Promise<{ content: string; tokensUsed: number }> {
    // 캐릭터 정보를 기반으로 시스템 메시지 생성
    const systemMessage = `당신은 ${character.name}이라는 AI 캐릭터입니다. 
성격: ${character.personality}
말투: ${character.speakingStyle}
설명: ${character.description}

사용자와의 대화에서 위 특성을 반영하여 응답해주세요.`;

    // 이전 대화 기록 포맷팅
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // 시스템 메시지와 사용자 메시지 추가
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...formattedMessages,
      { role: 'user', content: userMessage },
    ];

    // 선택된 AI 모델에 따라 다른 API 호출
    switch (aiModel) {
      case AIModel.GPT4:
        return this.callGPT4(fullMessages);
      case AIModel.CLAUDE3:
        return this.callClaude3(fullMessages);
      case AIModel.MISTRAL:
        return this.callMistral(fullMessages);
      case AIModel.CUSTOM:
        // 커스텀 모델은 현재 GPT-4로 대체
        return this.callGPT4(fullMessages);
      default:
        return this.callGPT4(fullMessages);
    }
  }

  private async callGPT4(messages: any[]): Promise<{ content: string; tokensUsed: number }> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages,
      temperature: 0.7,
    });

    return {
      content: response.choices[0].message.content,
      tokensUsed: response.usage.total_tokens,
    };
  }

  private async callClaude3(messages: any[]): Promise<{ content: string; tokensUsed: number }> {
    // Anthropic API 형식에 맞게 메시지 변환
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));

    const response = await this.anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      messages: anthropicMessages,
      max_tokens: 1000,
    });

    // Claude는 토큰 사용량을 직접 제공하지 않으므로 대략적인 추정값 사용
    const tokensUsed = Math.ceil(response.content[0].text.length / 4);

    return {
      content: response.content[0].text,
      tokensUsed,
    };
  }

  private async callMistral(messages: any[]): Promise<{ content: string; tokensUsed: number }> {
    const response = await this.mistral.chat({
      model: 'mistral-large-latest',
      messages,
    });

    // Mistral도 토큰 사용량을 직접 제공하지 않으므로 대략적인 추정값 사용
    const tokensUsed = Math.ceil(response.choices[0].message.content.length / 4);

    return {
      content: response.choices[0].message.content,
      tokensUsed,
    };
  }
} 