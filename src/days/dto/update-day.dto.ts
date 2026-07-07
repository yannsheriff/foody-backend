import { Score, SportLevel } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { WIRE_SCORES, WIRE_SPORT_LEVELS } from './create-day.dto';

export class UpdateDayDto {
  @ApiProperty({
    description: 'Score du repas du matin',
    enum: Score,
    required: false,
    nullable: true,
    example: 'leger',
  })
  @IsOptional()
  @IsIn(WIRE_SCORES)
  morning_score?: Score | null;

  @ApiProperty({
    description: 'Score du repas du midi',
    enum: Score,
    required: false,
    nullable: true,
    example: 'normal',
  })
  @IsOptional()
  @IsIn(WIRE_SCORES)
  afternoon_score?: Score | null;

  @ApiProperty({
    description: 'Score du repas du soir',
    enum: Score,
    required: false,
    nullable: true,
    example: 'copieux',
  })
  @IsOptional()
  @IsIn(WIRE_SCORES)
  evening_score?: Score | null;

  @ApiProperty({
    description: 'Niveau de grignotage de la journée (0 = aucun, 1 = beaucoup)',
    required: false,
    nullable: true,
    minimum: 0,
    maximum: 1,
    example: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  snack?: number | null;

  @ApiProperty({
    description:
      "Niveau d'effort sportif : none (repos) · normal · intense. Source de vérité du sport.",
    enum: SportLevel,
    required: false,
    nullable: true,
    example: 'intense',
  })
  @IsOptional()
  @IsIn(WIRE_SPORT_LEVELS)
  sport_level?: SportLevel | null;

  @ApiProperty({
    description:
      'Legacy : activité sportive effectuée (dérivé de sport_level, conservé pour compat).',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sport?: boolean;

  @ApiProperty({
    description: "Type d'activité sportive (legacy, non utilisé par la saisie)",
    required: false,
    nullable: true,
    example: 'course',
  })
  @IsOptional()
  @IsString()
  sport_type?: string | null;
}
