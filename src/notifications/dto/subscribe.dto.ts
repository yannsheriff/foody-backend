import { ApiProperty } from '@nestjs/swagger';

// Plain @ApiProperty DTO matching the rest of the codebase (no ValidationPipe is
// registered, so shape is checked manually in the controller).
class SubscriptionKeysDto {
  @ApiProperty({ description: 'Clé publique du client (base64url)' })
  p256dh: string;

  @ApiProperty({ description: "Secret d'authentification (base64url)" })
  auth: string;
}

export class SubscribeDto {
  @ApiProperty({ description: 'Endpoint Web Push renvoyé par le navigateur' })
  endpoint: string;

  @ApiProperty({ type: SubscriptionKeysDto })
  keys: SubscriptionKeysDto;
}
