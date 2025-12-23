import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private isDev: boolean;

  constructor(private configService: ConfigService) {
    this.isDev = this.configService.get<string>('NODE_ENV') !== 'production';
    // 이메일 전송을 위한 transporter 설정
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM'),
      to: email,
      subject: '[몽글AI] 비밀번호 재설정 인증 코드',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff3366;">비밀번호 재설정</h2>
          <p>안녕하세요,</p>
          <p>비밀번호 재설정을 요청하셨습니다. 아래 인증 코드를 입력해주세요:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #ff3366; font-size: 36px; margin: 0; letter-spacing: 8px;">${resetToken}</h1>
          </div>
          <p style="color: #666;">이 코드는 30분 후에 만료됩니다.</p>
          <p style="color: #999; font-size: 12px;">본인이 요청하지 않았다면 이 이메일을 무시하셔도 됩니다.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">몽글AI - AI 캐릭터와의 특별한 대화</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      if (this.isDev) {
        console.log(`[DEV] Password reset email sent to ${email}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendWelcomeEmail(email: string, username: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM'),
      to: email,
      subject: '[몽글AI] 회원가입을 환영합니다!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff3366;">몽글AI에 오신 것을 환영합니다!</h2>
          <p>안녕하세요, ${username}님!</p>
          <p>몽글AI 회원가입을 완료하셨습니다.</p>
          <p>이제 다양한 AI 캐릭터들과 대화를 나누고, 직접 캐릭터를 만들어보세요!</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #ff3366;">
            <h3 style="margin-top: 0; color: #333;">가입 혜택</h3>
            <ul style="color: #666;">
              <li>신규 가입 보너스 토큰 10개 지급</li>
              <li>무료 AI 캐릭터 대화</li>
              <li>캐릭터 생성 기능</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get<string>('FRONTEND_URL')}"
               style="background-color: #ff3366; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              지금 시작하기
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">몽글AI - AI 캐릭터와의 특별한 대화</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      if (this.isDev) {
        console.log(`[DEV] Welcome email sent to ${email}`);
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }
}
