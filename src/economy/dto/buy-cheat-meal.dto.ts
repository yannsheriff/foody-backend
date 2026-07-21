import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class BuyCheatMealDto {
  @ApiProperty({
    enum: ['morning', 'afternoon', 'evening'],
    description: 'Créneau du repas lourd à réparer aujourd’hui',
  })
  @IsIn(['morning', 'afternoon', 'evening'])
  slot: 'morning' | 'afternoon' | 'evening';
}
