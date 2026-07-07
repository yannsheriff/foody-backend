import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: "Le nom de l'utilisateur",
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: 'Le mot de passe',
    example: '0000',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password?: string;
}
