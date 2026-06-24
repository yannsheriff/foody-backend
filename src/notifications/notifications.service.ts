import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { isDayFullyTracked } from '../insights/insights.scoring';
import { SubscribeDto } from './dto/subscribe.dto';
import {
  REMINDER_TAG,
  REMINDER_URL,
  REMINDER_WORDINGS,
  ReminderWording,
} from './notifications.constants';

// The public key is public by design (the browser receives it). It carries a
// committed fallback only so getPublicKey()/the subscribe flow work locally.
// The PRIVATE key is a secret and is read from env ONLY — never committed.
// Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in env (.env locally,
// Vercel env vars in prod). Without VAPID_PRIVATE_KEY, sends are no-ops.
const FALLBACK_VAPID_PUBLIC =
  'BGwyh-7xHV6Vf9KMgaJ7sUIgwbvPxkmUX8n9iERXeySVXuUMVBe53M3_rMB4Iyc0tNEDvaOYXkz2YRCxaJh-6sI';

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly publicKey =
    process.env.VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC;
  // True once VAPID is fully configured (private key present). Sends are skipped
  // otherwise so a missing secret degrades gracefully instead of throwing.
  private readonly configured: boolean;

  constructor(private prisma: PrismaService) {
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    this.configured = !!privateKey;
    if (this.configured) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:yannis.cherif@innovorder.fr',
        this.publicKey,
        privateKey as string,
      );
    } else {
      this.logger.warn(
        'VAPID_PRIVATE_KEY non défini — les notifications push sont désactivées.',
      );
    }
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  async subscribe(userId: number, dto: SubscribeDto): Promise<{ ok: true }> {
    // Upsert by endpoint: re-subscribing the same device updates its keys and
    // reassigns ownership rather than creating a duplicate row.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { user_id: userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      create: {
        user_id: userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
    return { ok: true };
  }

  async unsubscribe(userId: number, endpoint: string): Promise<{ ok: true }> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, user_id: userId },
    });
    return { ok: true };
  }

  // Dev helper wired to a "Tester la notification" button — sends a one-off
  // push to every device the user has subscribed.
  async sendTest(userId: number): Promise<{ sent: number }> {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { user_id: userId },
    });
    let sent = 0;
    for (const sub of subs) {
      const ok = await this.send(sub, {
        title: 'Test réussi 🎉',
        body: 'Tes rappels Foody fonctionnent. À ce soir.',
        url: REMINDER_URL,
        tag: REMINDER_TAG,
      });
      if (ok) sent++;
    }
    return { sent };
  }

  // Called by the daily cron. Sends the reminder to every subscription whose
  // owner has NOT completed today (3 meals), evaluated in Europe/Paris.
  async sendDailyReminders(): Promise<{ candidates: number; sent: number }> {
    const subs = await this.prisma.pushSubscription.findMany();
    if (subs.length === 0) return { candidates: 0, sent: 0 };

    const wording = pickWording();
    const todayParis = parisYmd(new Date());
    // Cache the per-user completeness check so N devices = 1 query per user.
    const completeByUser = new Map<number, boolean>();
    let sent = 0;
    let candidates = 0;

    for (const sub of subs) {
      if (!completeByUser.has(sub.user_id)) {
        completeByUser.set(
          sub.user_id,
          await this.isTodayComplete(sub.user_id, todayParis),
        );
      }
      if (completeByUser.get(sub.user_id)) continue;
      candidates++;
      const ok = await this.send(sub, {
        title: wording.title,
        body: wording.body,
        url: REMINDER_URL,
        tag: REMINDER_TAG,
      });
      if (ok) sent++;
    }
    this.logger.log(
      `Daily reminders: ${sent}/${candidates} sent (${subs.length} subscriptions)`,
    );
    return { candidates, sent };
  }

  private async isTodayComplete(
    userId: number,
    todayParis: string,
  ): Promise<boolean> {
    // Small window (last 3 days) is enough to catch "today" across the UTC↔Paris
    // boundary without scanning the user's whole history.
    const since = new Date(Date.now() - 3 * 86_400_000);
    const days = await this.prisma.days.findMany({
      where: { user_id: userId, date: { gte: since } },
    });
    const todayRow = days.find((d) => parisYmd(d.date) === todayParis);
    return todayRow ? isDayFullyTracked(todayRow) : false;
  }

  // Returns true if delivered. Prunes the subscription on 404/410 (the browser
  // dropped it) so dead rows don't pile up.
  private async send(
    sub: { id: number; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<boolean> {
    if (!this.configured) return false;
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      return true;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => undefined);
      } else {
        this.logger.warn(
          `Push send failed (status ${statusCode ?? '?'}) for sub ${sub.id}`,
        );
      }
      return false;
    }
  }
}

// YYYY-MM-DD of a date in Europe/Paris (server runs in UTC on Vercel). en-CA
// formats as ISO-like YYYY-MM-DD.
function parisYmd(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

// Deterministic rotation: same wording for everyone on a given Paris day, but
// it advances each day, so no one gets the same text two evenings running.
function pickWording(): ReminderWording {
  const todayParis = parisYmd(new Date());
  const epochDay = Math.floor(Date.parse(todayParis) / 86_400_000);
  return REMINDER_WORDINGS[epochDay % REMINDER_WORDINGS.length];
}
