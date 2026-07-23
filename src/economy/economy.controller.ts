import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EconomyService } from './economy.service';
import { WalletDto } from './dto/wallet.dto';
import { BuyCheatMealDto } from './dto/buy-cheat-meal.dto';

interface AuthedRequest extends Request {
  user: { id: number };
}

@ApiTags('economy')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Solde de pièces + gels de flamme en réserve' })
  @ApiResponse({ status: 200, type: WalletDto })
  getWallet(@Req() req: AuthedRequest): Promise<WalletDto> {
    return this.economy.getWallet(req.user.id);
  }

  @Post('shop/freeze')
  @ApiOperation({ summary: 'Acheter un gel de flamme (70 🪙, max 1 en réserve)' })
  @ApiResponse({ status: 201, type: WalletDto })
  buyFreeze(@Req() req: AuthedRequest): Promise<WalletDto> {
    return this.economy.buyFreeze(req.user.id);
  }

  @Post('shop/cheat-meal')
  @ApiOperation({
    summary: 'Acheter un cheat meal en réserve (25 🪙 — il s’accumule)',
  })
  @ApiResponse({ status: 201, type: WalletDto })
  buyCheatMeal(@Req() req: AuthedRequest): Promise<WalletDto> {
    return this.economy.buyCheatMeal(req.user.id);
  }

  @Post('cheat-meal/use')
  @ApiOperation({
    summary: 'Consommer un cheat meal de la réserve sur un repas lourd du jour',
  })
  @ApiResponse({ status: 201, type: WalletDto })
  useCheatMeal(
    @Req() req: AuthedRequest,
    @Body() body: BuyCheatMealDto,
  ): Promise<WalletDto> {
    return this.economy.useCheatMeal(req.user.id, body.slot);
  }

  @Post('freeze/ack')
  @ApiOperation({
    summary: 'Marquer vu le « gel consommé » (dismiss de l’interstitiel)',
  })
  @ApiResponse({ status: 201 })
  ackFreeze(@Req() req: AuthedRequest): Promise<{ ok: true }> {
    return this.economy.ackFreeze(req.user.id);
  }
}
