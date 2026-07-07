import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Le mot de passe',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
