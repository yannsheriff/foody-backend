import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: "Le nom de l'utilisateur",
    example: 'John Doe',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Le mot de passe',
    example: '0000',
    required: false,
  })
  password?: string;
}
