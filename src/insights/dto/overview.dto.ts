import { ApiProperty } from '@nestjs/swagger';

export class OverviewWindowDto {
  @ApiProperty({
    example: 6.5,
    description: 'Moyenne /10 des journées complètes',
  })
  average: number;

  @ApiProperty({ example: 4, description: 'Journées à 8+ (optimales)' })
  optimalDays: number;

  @ApiProperty({
    example: 22,
    description: 'Journées complètes dans la fenêtre',
  })
  daysTracked: number;
}

export class OverviewWeekDto {
  @ApiProperty({
    example: '2026-07-06',
    description: 'Lundi de la semaine (UTC)',
  })
  start: string;

  @ApiProperty({
    example: 6.8,
    nullable: true,
    description: 'Moyenne de la semaine — null si aucune journée complète',
  })
  score: number | null;

  @ApiProperty({
    example: 5,
    description: 'Journées complètes dans la semaine',
  })
  days: number;
}

export class OverviewDayEdgeDto {
  @ApiProperty({
    example: 2,
    description: 'Jour de semaine UTC (0 = dimanche … 6 = samedi)',
  })
  weekday: number;

  @ApiProperty({ example: 7.2 })
  average: number;
}

export class OverviewDto {
  @ApiProperty({
    type: OverviewWindowDto,
    description: '30 derniers jours (aujourd’hui inclus)',
  })
  window: OverviewWindowDto;

  @ApiProperty({
    type: OverviewWindowDto,
    description: 'Les 30 jours précédents (délta)',
  })
  previous: OverviewWindowDto;

  @ApiProperty({
    example: {
      'tres-leger': 5,
      leger: 30,
      normal: 40,
      copieux: 20,
      'tres-copieux': 5,
    },
    description: 'Répartition des repas (%) sur les 30 derniers jours',
  })
  repartition: Record<string, number>;

  @ApiProperty({
    type: [OverviewWeekDto],
    description: '8 semaines glissantes (lundi UTC), la courante en dernier',
  })
  weeks: OverviewWeekDto[];

  @ApiProperty({
    type: OverviewDayEdgeDto,
    nullable: true,
    description:
      'Jour de semaine le plus fort (min 3 occurrences, écart ≥ 0,8 avec le plus faible)',
  })
  bestDay: OverviewDayEdgeDto | null;

  @ApiProperty({ type: OverviewDayEdgeDto, nullable: true })
  worstDay: OverviewDayEdgeDto | null;
}
