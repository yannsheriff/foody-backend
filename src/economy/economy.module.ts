import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';

@Module({
  imports: [PrismaModule],
  controllers: [EconomyController],
  providers: [EconomyService],
  exports: [EconomyService], // réutilisé par la boutique (achats) et le gel (streak)
})
export class EconomyModule {}
