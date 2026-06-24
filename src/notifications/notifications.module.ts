import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { CronController } from './cron.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, CronController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
