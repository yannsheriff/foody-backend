import { ApiProperty } from '@nestjs/swagger';

export class BadgeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  emoji: string;

  @ApiProperty()
  unlocked: boolean;

  @ApiProperty({
    example: '7 jours d’affilée sans un repas copieux.',
    description: 'Comment obtenir le badge — voix maison.',
  })
  description: string;

  @ApiProperty({
    example: 4,
    description:
      'Avancement (jours qualifiants ou meilleure série), borné à total.',
  })
  prog: number;

  @ApiProperty({ example: 7 })
  total: number;

  @ApiProperty({
    example: '2026-07-12T00:00:00.000Z',
    nullable: true,
    description:
      'Premier jour où l’objectif a été atteint — null si verrouillé.',
  })
  unlockedAt: string | null;
}
