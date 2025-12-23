import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PersonaPresetsService } from './persona-presets.service';
import { CreatePresetDto } from './dto/create-preset.dto';
import { UpdatePresetDto } from './dto/update-preset.dto';

@ApiTags('persona-presets')
@Controller()
export class PersonaPresetsController {
  constructor(private readonly presetsService: PersonaPresetsService) {}

  @Post('characters/:characterId/presets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프리셋 생성' })
  @ApiResponse({ status: 201, description: '프리셋이 생성되었습니다.' })
  async create(
    @Param('characterId') characterId: string,
    @Body() createPresetDto: CreatePresetDto,
    @Request() req,
  ) {
    return this.presetsService.create(
      characterId,
      createPresetDto,
      req.user.userId,
    );
  }

  @Get('characters/:characterId/presets')
  @ApiOperation({ summary: '캐릭터의 프리셋 목록' })
  @ApiResponse({ status: 200, description: '프리셋 목록' })
  async findByCharacter(@Param('characterId') characterId: string) {
    return this.presetsService.findByCharacter(characterId);
  }

  @Get('presets/:id')
  @ApiOperation({ summary: '프리셋 상세 조회' })
  @ApiResponse({ status: 200, description: '프리셋 정보' })
  @ApiResponse({ status: 404, description: '프리셋을 찾을 수 없습니다.' })
  async findOne(@Param('id') id: string) {
    return this.presetsService.findOne(id);
  }

  @Put('presets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프리셋 수정' })
  @ApiResponse({ status: 200, description: '프리셋이 수정되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '프리셋을 찾을 수 없습니다.' })
  async update(
    @Param('id') id: string,
    @Body() updatePresetDto: UpdatePresetDto,
    @Request() req,
  ) {
    return this.presetsService.update(id, updatePresetDto, req.user.userId);
  }

  @Delete('presets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프리셋 삭제' })
  @ApiResponse({ status: 200, description: '프리셋이 삭제되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '프리셋을 찾을 수 없습니다.' })
  async remove(@Param('id') id: string, @Request() req) {
    await this.presetsService.remove(id, req.user.userId);
    return { message: '프리셋이 삭제되었습니다.' };
  }

  @Post('presets/:id/set-default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '기본 프리셋으로 설정' })
  @ApiResponse({ status: 200, description: '기본 프리셋으로 설정되었습니다.' })
  async setDefault(@Param('id') id: string, @Request() req) {
    return this.presetsService.setDefault(id, req.user.userId);
  }

  @Post('presets/:id/duplicate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프리셋 복제' })
  @ApiResponse({ status: 201, description: '프리셋이 복제되었습니다.' })
  async duplicate(
    @Param('id') id: string,
    @Body('title') title: string,
    @Request() req,
  ) {
    return this.presetsService.duplicatePreset(id, title, req.user.userId);
  }
}
