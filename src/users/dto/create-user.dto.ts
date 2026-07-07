import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Le nom de l'utilisateur",
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "Le mot de passe de l'utilisateur",
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
