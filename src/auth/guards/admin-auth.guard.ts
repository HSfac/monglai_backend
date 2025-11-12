import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminToken = request.headers['x-admin-token'];

    const validAdminToken = this.configService.get<string>('ADMIN_TOKEN');

    if (!adminToken || adminToken !== validAdminToken) {
      throw new UnauthorizedException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}
