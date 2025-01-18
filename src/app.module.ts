import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DaysModule } from './days/days.module';

@Module({
  imports: [PrismaModule, DaysModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
