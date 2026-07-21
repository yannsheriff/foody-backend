import { ApiProperty } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({ example: 85, description: 'Solde de pièces (dérivé du ledger)' })
  balance: number;

  @ApiProperty({ example: 1, description: 'Gels de flamme en réserve (max 1)' })
  freezeStock: number;
}
