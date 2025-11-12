import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('사용자')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiResponse({ status: 200, description: '사용자 정보 조회 성공' })
  async getMe(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 수정' })
  @ApiResponse({ status: 200, description: '사용자 정보 수정 성공' })
  async updateMe(@Request() req, @Body() updateUserDto: any) {
    return this.usersService.update(req.user.userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/favorites')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 즐겨찾기 캐릭터 목록 조회' })
  @ApiResponse({ status: 200, description: '즐겨찾기 목록 조회 성공' })
  async getMyFavorites(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    return user.favoriteCharacters;
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/favorites/:characterId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '캐릭터 즐겨찾기 추가' })
  @ApiResponse({ status: 200, description: '즐겨찾기 추가 성공' })
  async addToFavorites(@Request() req, @Param('characterId') characterId: string) {
    return this.usersService.addCharacterToFavorites(req.user.userId, characterId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/favorites/:characterId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '캐릭터 즐겨찾기 제거' })
  @ApiResponse({ status: 200, description: '즐겨찾기 제거 성공' })
  async removeFromFavorites(@Request() req, @Param('characterId') characterId: string) {
    return this.usersService.removeCharacterFromFavorites(req.user.userId, characterId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/adult-verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: '성인인증' })
  @ApiResponse({ status: 200, description: '성인인증 성공' })
  async verifyAdult(@Request() req, @Body() verifyDto: { verificationToken: string }) {
    return this.usersService.verifyAdult(req.user.userId, verifyDto.verificationToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/adult-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '성인인증 상태 조회' })
  @ApiResponse({ status: 200, description: '성인인증 상태 조회 성공' })
  async getAdultStatus(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      isAdultVerified: user.isAdultVerified,
      adultVerifiedAt: user.adultVerifiedAt,
    };
  }
} 