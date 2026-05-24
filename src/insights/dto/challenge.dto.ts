import { ApiProperty } from '@nestjs/swagger';

export class ChallengeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: ['weekly', 'monthly'] })
  type: 'weekly' | 'monthly';

  @ApiProperty()
  typeLabel: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  leftLabel: string;

  @ApiProperty({ enum: ['active', 'upcoming', 'completed'] })
  status: 'active' | 'upcoming' | 'completed';

  @ApiProperty({ required: false, nullable: true })
  subtitle?: string;
}

export class ChallengesResponseDto {
  @ApiProperty({ type: [ChallengeDto] })
  active: ChallengeDto[];

  @ApiProperty({ type: [ChallengeDto] })
  upcoming: ChallengeDto[];

  @ApiProperty({ type: [ChallengeDto] })
  completed: ChallengeDto[];
}
