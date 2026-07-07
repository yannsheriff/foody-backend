import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, ValidateNested } from 'class-validator';

class SubscriptionKeysDto {
  @ApiProperty({ description: 'Clé publique du client (base64url)' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: "Secret d'authentification (base64url)" })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class SubscribeDto {
  @ApiProperty({ description: 'Endpoint Web Push renvoyé par le navigateur' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint: string;

  @ApiProperty({ type: SubscriptionKeysDto })
  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys: SubscriptionKeysDto;
}
