import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModel } from '../characters/schemas/character.schema';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

@Injectable()
export class AIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private grok: OpenAI; // xAI Grok uses OpenAI-compatible API

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('CLAUDE_API_KEY'),
    });

    // xAI Grok API (OpenAI-compatible)
    this.grok = new OpenAI({
      apiKey: this.configService.get<string>('XAI_API_KEY'),
      baseURL: 'https://api.x.ai/v1',
    });
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
      case AIModel.GROK:
        return this.callGrok(fullMessages);
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
      content: response.choices[0].message.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
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

    // Claude 응답에서 텍스트 블록 추출
    const firstContent = response.content[0];
    const contentText = firstContent.type === 'text' ? firstContent.text : '';

    // Claude는 토큰 사용량을 직접 제공하지 않으므로 대략적인 추정값 사용
    const tokensUsed = Math.ceil(contentText.length / 4);

    return {
      content: contentText,
      tokensUsed,
    };
  }

  private async callGrok(messages: any[]): Promise<{ content: string; tokensUsed: number }> {
    const response = await this.grok.chat.completions.create({
      model: 'grok-beta',
      messages,
      temperature: 0.7,
    });

    return {
      content: response.choices[0].message.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * 스트리밍 응답 생성 (실시간 타이핑 효과)
   * @param aiModel AI 모델
   * @param character 캐릭터
   * @param messages 이전 메시지들
   * @param userMessage 사용자 메시지
   * @param onChunk 청크 수신 콜백
   */
  async generateStreamingResponse(
    aiModel: AIModel,
    character: any,
    messages: any[],
    userMessage: string,
    onChunk: (chunk: string) => void,
  ): Promise<{ totalTokensUsed: number }> {
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

    // 선택된 AI 모델에 따라 다른 스트리밍 API 호출
    switch (aiModel) {
      case AIModel.GPT4:
        return this.streamGPT4(fullMessages, onChunk);
      case AIModel.CLAUDE3:
        return this.streamClaude3(fullMessages, onChunk);
      case AIModel.GROK:
        return this.streamGrok(fullMessages, onChunk);
      case AIModel.CUSTOM:
        // 커스텀 모델은 현재 GPT-4로 대체
        return this.streamGPT4(fullMessages, onChunk);
      default:
        return this.streamGPT4(fullMessages, onChunk);
    }
  }

  /**
   * GPT-4 스트리밍 응답
   */
  private async streamGPT4(
    messages: any[],
    onChunk: (chunk: string) => void,
  ): Promise<{ totalTokensUsed: number }> {
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages,
      temperature: 0.7,
      stream: true,
    });

    let totalTokensUsed = 0;
    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    // GPT-4는 스트리밍에서 토큰 정보를 제공하지 않으므로 추정
    totalTokensUsed = Math.ceil(fullContent.length / 4);

    return { totalTokensUsed };
  }

  /**
   * Claude 3 스트리밍 응답
   */
  private async streamClaude3(
    messages: any[],
    onChunk: (chunk: string) => void,
  ): Promise<{ totalTokensUsed: number }> {
    // Anthropic API 형식에 맞게 메시지 변환
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));

    const stream = await this.anthropic.messages.stream({
      model: 'claude-3-opus-20240229',
      messages: anthropicMessages,
      max_tokens: 1000,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const content = chunk.delta.text;
        fullContent += content;
        onChunk(content);
      }
    }

    // Claude는 토큰 정보를 제공하지 않으므로 추정
    const totalTokensUsed = Math.ceil(fullContent.length / 4);

    return { totalTokensUsed };
  }

  /**
   * Grok 스트리밍 응답
   */
  private async streamGrok(
    messages: any[],
    onChunk: (chunk: string) => void,
  ): Promise<{ totalTokensUsed: number }> {
    const stream = await this.grok.chat.completions.create({
      model: 'grok-beta',
      messages,
      temperature: 0.7,
      stream: true,
    });

    let totalTokensUsed = 0;
    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    // Grok은 스트리밍에서 토큰 정보를 제공하지 않으므로 추정
    totalTokensUsed = Math.ceil(fullContent.length / 4);

    return { totalTokensUsed };
  }
} 