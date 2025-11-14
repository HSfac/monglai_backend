import { PartialType } from '@nestjs/swagger';
import { CreateCharacterDto } from './create-character.dto';

/**
 * UpdateCharacterDto는 CreateCharacterDto와 동일하지만,
 * 모든 필드가 선택사항(optional)입니다.
 *
 * PartialType을 사용하면 자동으로 모든 필드를 optional로 만들어줍니다.
 */
export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {}
