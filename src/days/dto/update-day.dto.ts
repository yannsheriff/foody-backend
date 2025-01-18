import { Score } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDayDto {
  @ApiProperty({
    description: 'Score du matin',
    enum: Score,
    required: false,
    example: 'normal',
  })
  morning_score?: Score;

  @ApiProperty({
    description: 'Score de l\'après-midi',
    enum: Score,
    required: false,
    example: 'light',
  })
  afternoon_score?: Score;

  @ApiProperty({
    description: 'Score du soir',
    enum: Score,
    required: false,
    example: 'heavy',
  })
  evening_score?: Score;

  @ApiProperty({
    description: 'Score supplémentaire',
    enum: Score,
    required: false,
    example: 'normal',
  })
  extra_score?: Score;
} 