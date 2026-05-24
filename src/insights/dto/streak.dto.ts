import { ApiProperty } from '@nestjs/swagger';

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
}
