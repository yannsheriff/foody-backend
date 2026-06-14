import { Score, SportLevel } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDayDto {
  @ApiProperty({
    description: "L'ID de l'utilisateur",
    example: 1,
  })
  user_id: number;

  @ApiProperty({
    description: 'Score du repas du matin',
    enum: Score,
    required: false,
    nullable: true,
    example: 'leger',
  })
  morning_score?: Score | null;

  @ApiProperty({
    description: 'Score du repas du midi',
    enum: Score,
    required: false,
    nullable: true,
    example: 'normal',
  })
  afternoon_score?: Score | null;

  @ApiProperty({
    description: 'Score du repas du soir',
    enum: Score,
    required: false,
    nullable: true,
    example: 'copieux',
  })
  evening_score?: Score | null;

  @ApiProperty({
    description: 'Niveau de grignotage de la journée (0 = aucun, 1 = beaucoup)',
    required: false,
    nullable: true,
    minimum: 0,
    maximum: 1,
    example: 0.2,
  })
  snack?: number | null;

  @ApiProperty({
    description: 'Date du jour',
    required: false,
    example: '2026-05-23T00:00:00.000Z',
  })
  date?: Date;

  @ApiProperty({
    description:
      "Niveau d'effort sportif : none (repos) · normal · intense. Source de vérité du sport.",
    enum: SportLevel,
    required: false,
    nullable: true,
    example: 'normal',
  })
  sport_level?: SportLevel | null;

  @ApiProperty({
    description:
      'Legacy : activité sportive effectuée (dérivé de sport_level, conservé pour compat).',
    required: false,
    default: false,
    example: true,
  })
  sport?: boolean;

  @ApiProperty({
    description: "Type d'activité sportive (legacy, non utilisé par la saisie)",
    required: false,
    nullable: true,
    example: 'course',
  })
  sport_type?: string | null;
}
