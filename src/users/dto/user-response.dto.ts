import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: "L'ID de l'utilisateur",
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiProperty({
    description: "Le nom de l'utilisateur",
    example: 'John Doe',
  })
  name: string;
}
