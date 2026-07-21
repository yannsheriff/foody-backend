import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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
}
