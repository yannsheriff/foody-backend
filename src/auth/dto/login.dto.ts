import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Le mot de passe',
    example: 'password123',
  })
  password: string;
}
