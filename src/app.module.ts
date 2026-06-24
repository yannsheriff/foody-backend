import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DaysModule } from './days/days.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InsightsModule } from './insights/insights.module';
import { ChallengesModule } from './challenges/challenges.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    DaysModule,
    UsersModule,
    AuthModule,
    InsightsModule,
    ChallengesModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
