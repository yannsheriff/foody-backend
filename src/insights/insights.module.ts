import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EconomyModule } from '../economy/economy.module';

@Module({
  // EconomyModule : la flamme consomme les gels (ponts) via EconomyService.
  imports: [PrismaModule, EconomyModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
