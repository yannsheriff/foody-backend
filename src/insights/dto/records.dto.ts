import { ApiProperty } from '@nestjs/swagger';

export class RecordsDto {
  @ApiProperty({ description: 'Nombre total de jours pleinement suivis' })
  daysTracked: number;

  @ApiProperty({ description: 'Meilleur score sur une journée', example: 9.5 })
  bestScore: number;

  @ApiProperty({ description: 'Plus longue série jamais atteinte' })
  streakRecord: number;

  @ApiProperty({ description: 'Moyenne du mois en cours', example: 6.8 })
  monthAverage: number;
}
