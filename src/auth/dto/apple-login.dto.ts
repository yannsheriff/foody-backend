import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({
    description:
      'Identity token JWT fourni par Sign in with Apple (client iOS)',
  })
  @IsString()
  identity_token: string;

  @ApiProperty({
    required: false,
    description:
      'Prénom fourni par Apple — à la PREMIÈRE autorisation seulement, jamais ensuite',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}
