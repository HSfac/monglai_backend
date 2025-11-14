import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetPresignedUrlDto {
  @ApiProperty({
    description: '파일 이름',
    example: 'character-image.jpg',
  })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: '파일 MIME 타입',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiPropertyOptional({
    description: 'S3 폴더 경로',
    example: 'characters',
    default: 'images',
  })
  @IsString()
  @IsOptional()
  folder?: string;
}

export class DeleteImageDto {
  @ApiProperty({
    description: '삭제할 이미지 URL',
    example: 'https://bucket.s3.region.amazonaws.com/images/file.jpg',
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
