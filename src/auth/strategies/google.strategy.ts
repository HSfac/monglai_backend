import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      username: name.givenName + ' ' + name.familyName,
      profileImage: photos[0].value,
      accessToken,
    };

    // 사용자 조회 또는 생성
    const existingUser = await this.usersService.findByEmail(user.email);
    if (existingUser) {
      return done(null, existingUser);
    }

    // 새 사용자 생성
    const newUser = await this.usersService.createSocialUser(
      user.email,
      user.username,
      user.profileImage,
    );
    return done(null, newUser);
  }
} 