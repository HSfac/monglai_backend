import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { World, WorldSchema } from './schemas/world.schema';
import { WorldsController } from './worlds.controller';
import { WorldsService } from './worlds.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: World.name, schema: WorldSchema }]),
  ],
  controllers: [WorldsController],
  providers: [WorldsService],
  exports: [WorldsService],
})
export class WorldsModule {}
