import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: "L'email de l'utilisateur",
    example: 'john.doe@example.com',
  })
  // Email insensible à la casse : normalisé en minuscules (+ trim) avant
  // la comparaison exacte Prisma. Miroir de CreateUserDto.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
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
