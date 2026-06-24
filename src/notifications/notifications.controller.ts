import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { SubscribeDto } from './dto/subscribe.dto';

interface AuthedRequest extends Request {
  user: { id: number };
}

@ApiTags('notifications')
@Controller('me/push')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('public-key')
  @ApiOperation({ summary: 'Clé VAPID publique pour s’abonner au Web Push' })
  @ApiResponse({ status: 200 })
  getPublicKey(): { publicKey: string } {
    return { publicKey: this.notifications.getPublicKey() };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Enregistrer un abonnement push pour cet appareil' })
  @ApiResponse({ status: 201 })
  subscribe(
    @Req() req: AuthedRequest,
    @Body() body: SubscribeDto,
  ): Promise<{ ok: true }> {
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      throw new BadRequestException('endpoint et keys.{p256dh,auth} requis');
    }
    return this.notifications.subscribe(req.user.id, body);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Supprimer l’abonnement push de cet appareil' })
  @ApiResponse({ status: 201 })
  unsubscribe(
    @Req() req: AuthedRequest,
    @Body() body: { endpoint?: string },
  ): Promise<{ ok: true }> {
    if (!body?.endpoint) throw new BadRequestException('endpoint requis');
    return this.notifications.unsubscribe(req.user.id, body.endpoint);
  }

  @Post('test')
  @ApiOperation({
    summary: 'Envoyer une notification de test à cet utilisateur',
  })
  @ApiResponse({ status: 201 })
  test(@Req() req: AuthedRequest): Promise<{ sent: number }> {
    return this.notifications.sendTest(req.user.id);
  }
}
