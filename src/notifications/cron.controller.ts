import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CronGuard } from './cron.guard';
import { NotificationsService } from './notifications.service';

// Hit once a day by Vercel Cron (see vercel.json). GET because Vercel Cron only
// issues GET requests. Hidden from Swagger — it's infrastructure, not a public
// API. Guarded by CRON_SECRET, not JWT.
@ApiExcludeController()
@Controller('cron')
@UseGuards(CronGuard)
export class CronController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('reminders')
  sendReminders(): Promise<{ candidates: number; sent: number }> {
    return this.notifications.sendDailyReminders();
  }
}
