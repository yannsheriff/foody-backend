import { ApiProperty } from '@nestjs/swagger';

export class FreezeConsumedDto {
  @ApiProperty({
    description: 'Jour manqué couvert par le gel (YYYY-MM-DD UTC)',
    example: '2026-07-20',
  })
  day: string;

  @ApiProperty({ description: 'Gels restant en réserve après conso', example: 0 })
  stock: number;
}

export class StreakDto {
  @ApiProperty({ description: 'Série en cours (jours)', example: 7 })
  current: number;

  @ApiProperty({
    description: 'Plus longue série jamais atteinte',
    example: 21,
  })
  record: number;

  @ApiProperty({
    description: 'Date ISO du dernier jour pleinement rempli',
    nullable: true,
    example: '2026-05-22',
  })
  lastFilledDate: string | null;

  @ApiProperty({
    description:
      'Gel consommé pas encore vu (pilote l’interstitiel « ta flamme a tenu ») — null sinon',
    nullable: true,
    type: FreezeConsumedDto,
  })
  freezeConsumed: FreezeConsumedDto | null;
}
