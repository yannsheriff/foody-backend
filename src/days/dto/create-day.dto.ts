import { Score } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDayDto {
  @ApiProperty({
    description: "L'ID de l'utilisateur",
    example: 1,
  })
  user_id: number;

  @ApiProperty({
    description: 'Score du matin',
    enum: Score,
    required: false,
    nullable: true,
    example: 'normal',
  })
  morning_score?: Score | null;

  @ApiProperty({
    description: "Score de l'après-midi",
    enum: Score,
    required: false,
    nullable: true,
    example: 'light',
  })
  afternoon_score?: Score | null;

  @ApiProperty({
    description: 'Score du soir',
    enum: Score,
    required: false,
    nullable: true,
    example: 'heavy',
  })
  evening_score?: Score | null;

  @ApiProperty({
    description: 'Score supplémentaire',
    enum: Score,
    required: false,
    nullable: true,
    example: 'normal',
  })
  extra_score?: Score | null;

  @ApiProperty({
    description: 'Date du jour',
    required: false,
    example: '2024-01-18T00:00:00.000Z',
  })
  date?: Date;
}
