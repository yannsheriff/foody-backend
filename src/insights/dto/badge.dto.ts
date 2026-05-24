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
}
