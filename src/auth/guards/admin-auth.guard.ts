import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminToken = request.headers['x-admin-token'];

    if (!adminToken) {
      throw new UnauthorizedException('관리자 인증 토큰이 필요합니다.');
    }

    try {
      // JWT 토큰 검증
      const payload = this.jwtService.verify(adminToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // isAdmin 확인
      if (!payload.isAdmin) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }

      // request에 user 정보 추가
      request.adminUser = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 관리자 토큰입니다.');
    }
  }
}
