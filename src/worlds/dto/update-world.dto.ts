import { PartialType } from '@nestjs/swagger';
import { CreateWorldDto } from './create-world.dto';

export class UpdateWorldDto extends PartialType(CreateWorldDto) {}
