import { Score } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDayDto {
  @ApiProperty({
    description: 'Score du matin',
    enum: Score,
    required: false,
    nullable: true,
    example: 'normal',
  })
  morning_score?: Score | null;

  @ApiProperty({
    description: "Score de l'après-midi",
    enum: Score,
    required: false,
    nullable: true,
    example: 'light',
  })
  afternoon_score?: Score | null;

  @ApiProperty({
    description: 'Score du soir',
    enum: Score,
    required: false,
    nullable: true,
    example: 'heavy',
  })
  evening_score?: Score | null;

  @ApiProperty({
    description: 'Score supplémentaire',
    enum: Score,
    required: false,
    nullable: true,
    example: 'normal',
  })
  extra_score?: Score | null;

  @ApiProperty({
    description: 'Activité sportive effectuée',
    required: false,
    example: true,
  })
  sport?: boolean;
}
