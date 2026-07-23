import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RewardsService } from './rewards.service';
import {
  AchievementDto,
  ActiveWeeklyDto,
  CollectionDto,
  RewardsDto,
  SelectWeeklyDto,
  SetIntentionDto,
} from './dto/rewards.dto';

interface AuthedRequest extends Request {
  user: { id: number };
}

@ApiTags('rewards')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('rewards')
  @ApiOperation({
    summary:
      'Onglet Récompenses : défi de la semaine (ou 2 offres si non choisi), points & badge du mois',
  })
  @ApiResponse({ status: 200, type: RewardsDto })
  getRewards(@Req() req: AuthedRequest): Promise<RewardsDto> {
    return this.rewards.getRewards(req.user.id);
  }

  @Post('weekly/select')
  @ApiOperation({
    summary:
      'Choisir son défi de la semaine parmi les 2 offres (verrouillé jusqu’à dimanche, objectif proraté)',
  })
  @ApiResponse({ status: 201, type: ActiveWeeklyDto })
  @ApiResponse({
    status: 400,
    description: 'Ce défi n’est pas proposé cette semaine',
  })
  @ApiResponse({
    status: 409,
    description: 'Un défi est déjà choisi cette semaine',
  })
  selectWeekly(
    @Req() req: AuthedRequest,
    @Body() body: SelectWeeklyDto,
  ): Promise<ActiveWeeklyDto> {
    return this.rewards.selectWeekly(req.user.id, body.challengeId);
  }

  @Post('intention')
  @ApiOperation({
    summary:
      "Synchroniser l'intention d'onboarding (pondère le tirage des défis)",
  })
  @ApiResponse({ status: 201 })
  setIntention(
    @Req() req: AuthedRequest,
    @Body() body: SetIntentionDto,
  ): Promise<{ ok: true }> {
    return this.rewards.setIntention(req.user.id, body.intention);
  }

  @Get('collection')
  @ApiOperation({
    summary: 'Collection unifiée : badges mensuels + accomplissements',
  })
  @ApiResponse({ status: 200, type: CollectionDto })
  getCollection(@Req() req: AuthedRequest): Promise<CollectionDto> {
    return this.rewards.getCollection(req.user.id);
  }

  @Get('badges')
  @ApiOperation({
    summary: 'Accomplissements débloqués / à débloquer (vue Profil)',
  })
  @ApiResponse({ status: 200, type: [AchievementDto] })
  getBadges(@Req() req: AuthedRequest): Promise<AchievementDto[]> {
    return this.rewards.getBadges(req.user.id);
  }
}
