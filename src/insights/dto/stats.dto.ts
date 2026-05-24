import { ApiProperty } from '@nestjs/swagger';

class RepartitionDto {
  @ApiProperty() 'tres-leger': number;
  @ApiProperty() leger: number;
  @ApiProperty() normal: number;
  @ApiProperty() copieux: number;
  @ApiProperty() 'tres-copieux': number;
}

class WeekTrendPoint {
  @ApiProperty({ example: 'S21' })
  week: string;

  @ApiProperty({ example: 6.8 })
  score: number;
}

class StatsInsightDto {
  @ApiProperty({ example: 'Tes weekends tirent ta note vers le bas' })
  headline: string;

  @ApiProperty({ example: 'Score moyen weekend : 5,4 · semaine : 7,6' })
  body: string;
}

export class StatsDto {
  @ApiProperty({ description: 'Moyenne du mois', example: 6.8 })
  average: number;

  @ApiProperty({ description: 'Nombre de journées 8+', example: 14 })
  optimalDays: number;

  @ApiProperty({ type: RepartitionDto })
  repartition: RepartitionDto;

  @ApiProperty({ type: [WeekTrendPoint] })
  weeklyTrend: WeekTrendPoint[];

  @ApiProperty({ type: StatsInsightDto, nullable: true })
  insight: StatsInsightDto | null;
}
