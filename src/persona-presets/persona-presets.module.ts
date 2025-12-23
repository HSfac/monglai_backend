import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PersonaPreset, PersonaPresetSchema } from './schemas/persona-preset.schema';
import { PersonaPresetsController } from './persona-presets.controller';
import { PersonaPresetsService } from './persona-presets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PersonaPreset.name, schema: PersonaPresetSchema },
    ]),
  ],
  controllers: [PersonaPresetsController],
  providers: [PersonaPresetsService],
  exports: [PersonaPresetsService],
})
export class PersonaPresetsModule {}
