import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChallengesService } from './challenges.service';
import {
  AbandonResultDto,
  ActiveChallengeDto,
  ChallengesHubDto,
} from './dto/challenges.dto';

interface AuthedRequest extends Request {
  user: { id: number };
}

@ApiTags('challenges')
@Controller('me/challenges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  @ApiOperation({
    summary: 'Hub des défis : défi en cours + niveaux 1-4 avec progression',
  })
  @ApiResponse({ status: 200, type: ChallengesHubDto })
  getHub(@Req() req: AuthedRequest): Promise<ChallengesHubDto> {
    return this.challenges.getHub(req.user.id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Démarrer un défi (un seul défi actif à la fois)' })
  @ApiParam({ name: 'id', example: 'copieux-5' })
  @ApiResponse({ status: 201, type: ActiveChallengeDto })
  @ApiResponse({ status: 404, description: 'Défi introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Défi déjà relevé, niveau verrouillé ou défi déjà en cours',
  })
  start(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<ActiveChallengeDto> {
    return this.challenges.start(req.user.id, id);
  }

  @Post(':id/abandon')
  @HttpCode(200)
  @ApiOperation({ summary: 'Arrêter le défi en cours' })
  @ApiParam({ name: 'id', example: 'copieux-5' })
  @ApiResponse({ status: 200, type: AbandonResultDto })
  @ApiResponse({ status: 404, description: 'Aucun défi en cours avec cet id' })
  abandon(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<AbandonResultDto> {
    return this.challenges.abandon(req.user.id, id);
  }
}
