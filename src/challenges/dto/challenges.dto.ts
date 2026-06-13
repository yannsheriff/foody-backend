import { ApiProperty } from '@nestjs/swagger';

export class ActiveChallengeDto {
  @ApiProperty({ example: 'copieux-5' })
  id: string;

  @ApiProperty({ example: '🥗' })
  emoji: string;

  @ApiProperty({ example: '5 jours sans repas copieux' })
  title: string;

  @ApiProperty({ description: 'Libellé du type de défi', example: 'Copieux' })
  kind: string;

  @ApiProperty({ example: '5 jours' })
  goal: string;

  @ApiProperty({ example: 2 })
  level: number;

  @ApiProperty({ description: 'Progression actuelle', example: 3 })
  prog: number;

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({
    description: 'Reste à faire, formulé',
    example: 'Encore 2 jours',
  })
  left: string;

  @ApiProperty({ example: '2026-06-10T08:12:00.000Z' })
  startedAt: string;
}

export class ChallengeItemDto {
  @ApiProperty({ example: 'copieux-5' })
  id: string;

  @ApiProperty({ example: '🥗' })
  emoji: string;

  @ApiProperty({ example: '5 jours sans repas copieux' })
  title: string;

  @ApiProperty({ description: 'Libellé du type de défi', example: 'Copieux' })
  kind: string;

  @ApiProperty({ example: '5 jours' })
  goal: string;

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ enum: ['done', 'active', 'todo', 'locked'] })
  state: 'done' | 'active' | 'todo' | 'locked';

  @ApiProperty({
    description: 'Note minimale par jour (défis de type note)',
    required: false,
    example: 7,
  })
  minScore?: number;

  @ApiProperty({
    description: 'Fenêtre glissante en jours (défis de type sport)',
    required: false,
    example: 7,
  })
  windowDays?: number;

  @ApiProperty({
    description: 'Date de complétion (état done uniquement)',
    required: false,
    nullable: true,
    example: '2026-05-02',
  })
  completedAt?: string;

  @ApiProperty({
    description: 'Progression (état active uniquement)',
    required: false,
    example: 3,
  })
  prog?: number;

  @ApiProperty({
    description: 'Reste à faire (état active uniquement)',
    required: false,
    example: 'Encore 2 jours',
  })
  left?: string;
}

export class ChallengeLevelDto {
  @ApiProperty({ example: 2 })
  n: number;

  @ApiProperty({ example: '🌿' })
  emoji: string;

  @ApiProperty({ description: 'Nom court (carte)', example: 'Confirmé' })
  short: string;

  @ApiProperty({ example: 'On passe à la vitesse supérieure' })
  title: string;

  @ApiProperty({ example: 'Les bonnes habitudes commencent à rentrer' })
  tagline: string;

  @ApiProperty({ enum: ['done', 'current', 'locked'] })
  state: 'done' | 'current' | 'locked';

  @ApiProperty({ type: [ChallengeItemDto] })
  items: ChallengeItemDto[];
}

export class ChallengesHubDto {
  @ApiProperty({ type: ActiveChallengeDto, nullable: true })
  active: ActiveChallengeDto | null;

  @ApiProperty({ type: [ChallengeLevelDto] })
  levels: ChallengeLevelDto[];
}

export class AbandonResultDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
