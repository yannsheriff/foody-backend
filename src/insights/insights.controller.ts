import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InsightsService } from './insights.service';
import { StreakDto } from './dto/streak.dto';
import { RecordsDto } from './dto/records.dto';
import { StatsDto } from './dto/stats.dto';
import { OverviewDto } from './dto/overview.dto';

interface AuthedRequest extends Request {
  user: { id: number };
}

@ApiTags('insights')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('streak')
  @ApiOperation({ summary: 'Série en cours de jours consécutifs remplis' })
  @ApiResponse({ status: 200, type: StreakDto })
  getStreak(@Req() req: AuthedRequest): Promise<StreakDto> {
    return this.insights.getStreak(req.user.id);
  }

  @Get('records')
  @ApiOperation({
    summary: 'Records personnels (meilleur score, série record, etc.)',
  })
  @ApiResponse({ status: 200, type: RecordsDto })
  getRecords(@Req() req: AuthedRequest): Promise<RecordsDto> {
    return this.insights.getRecords(req.user.id);
  }

  @Get('overview')
  @ApiOperation({
    summary:
      'Vue d’ensemble glissante : 30 derniers jours (+ deltas vs les 30 précédents), 8 semaines glissantes, jour fort/faible',
  })
  @ApiResponse({ status: 200, type: OverviewDto })
  getOverview(@Req() req: AuthedRequest): Promise<OverviewDto> {
    return this.insights.getOverview(req.user.id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Stats mensuelles : moyenne, répartition, tendance',
    deprecated: true,
    description:
      'Conservé pour les anciens clients — les fronts utilisent GET /me/overview (glissant) depuis 07/2026.',
  })
  @ApiQuery({ name: 'month', required: false, example: '2026-05' })
  @ApiResponse({ status: 200, type: StatsDto })
  getStats(
    @Req() req: AuthedRequest,
    @Query('month') month?: string,
  ): Promise<StatsDto> {
    return this.insights.getStats(req.user.id, month);
  }
}
