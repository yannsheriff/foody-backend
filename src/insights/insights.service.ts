import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Days } from '@prisma/client';
import {
  computeDayScore,
  isDayFullyTracked,
  startOfDay,
  ymd,
} from './insights.scoring';
import { EconomyService } from '../economy/economy.service';
import {
  currentStreakWithBridges,
  findBridgeCandidate,
  recordStreakWithBridges,
} from '../economy/freeze.progress';
import { activeFreezePurchasedAt } from '../economy/wallet';
import { StreakDto } from './dto/streak.dto';
import { RecordsDto } from './dto/records.dto';
import { StatsDto } from './dto/stats.dto';
import { OverviewDto } from './dto/overview.dto';

@Injectable()
export class InsightsService {
  constructor(
    private prisma: PrismaService,
    private economy: EconomyService,
  ) {}

  // Streak = consecutive on-time days ending today or yesterday (late-backfilled
  // days never revive a lost flame). Gel de flamme (Phase 3) : les jours couverts
  // par un FreezeConsumption sont des « ponts » qui comptent comme on-time — et
  // un gel en stock se consomme ici, en lazy, dès qu'un jour manqué past-grace
  // pontable augmente la série (jamais tant que le catch-up peut rattraper).
  async getStreak(userId: number): Promise<StreakDto> {
    const now = new Date();
    const days = await this.loadDays(userId);

    const economy = await this.economy.loadAndSync(userId);
    const bridges = new Set(
      economy.consumptions.map((c) => ymd(new Date(c.day))),
    );
    let stock = economy.freezeStock;
    const purchasedAt = activeFreezePurchasedAt(
      economy.txns,
      economy.consumptions,
    );
    const candidate = findBridgeCandidate(
      days,
      bridges,
      stock,
      purchasedAt,
      now,
    );
    if (candidate) {
      await this.economy.consumeFreeze(userId, candidate);
      bridges.add(ymd(candidate));
      stock -= 1;
    }

    const current = currentStreakWithBridges(days, bridges, now);
    const record = recordStreakWithBridges(days, bridges);
    const sorted = [...days].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const last = sorted.find((d) => isDayFullyTracked(d));
    const unseen = await this.economy.unseenFreeze(userId);
    return {
      current,
      record,
      lastFilledDate: last ? ymd(new Date(last.date)) : null,
      freezeConsumed: unseen ? { day: unseen.day, stock } : null,
    };
  }

  async getRecords(userId: number): Promise<RecordsDto> {
    const days = await this.loadDays(userId);
    const tracked = days.filter(isDayFullyTracked);
    const bestScore = tracked.reduce(
      (m, d) => Math.max(m, computeDayScore(d)),
      0,
    );
    const now = new Date();
    const monthDays = days.filter((d) => {
      const date = new Date(d.date);
      return (
        date.getUTCFullYear() === now.getUTCFullYear() &&
        date.getUTCMonth() === now.getUTCMonth() &&
        isDayFullyTracked(d)
      );
    });
    const monthAverage = monthDays.length
      ? Math.round(
          (monthDays.reduce((s, d) => s + computeDayScore(d), 0) /
            monthDays.length) *
            10,
        ) / 10
      : 0;
    return {
      daysTracked: tracked.length,
      bestScore: Math.round(bestScore * 10) / 10,
      streakRecord: recordStreakWithBridges(
        days,
        new Set(
          (
            await this.prisma.freezeConsumption.findMany({
              where: { user_id: userId },
            })
          ).map((c) => ymd(new Date(c.day))),
        ),
      ),
      monthAverage,
    };
  }

  /**
   * Vue d'ensemble glissante : 30 derniers jours (+ les 30 d'avant pour les
   * deltas), 8 semaines calendaires glissantes (lundi UTC), jour de semaine
   * fort/faible. Remplace la lecture mensuelle de getStats côté produit —
   * une fenêtre calendaire perd son historique à chaque 1er du mois.
   * Les fenêtres sont refiltrées en code : le SQL n'est qu'un préfiltre.
   */
  async getOverview(userId: number): Promise<OverviewDto> {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const currentMonday = this.mondayOf(today);
    const chartStart = new Date(currentMonday.getTime() - 7 * 7 * 86_400_000);
    const windowStart = new Date(today.getTime() - 29 * 86_400_000);
    const prevStart = new Date(today.getTime() - 59 * 86_400_000);
    const loadStart = new Date(
      Math.min(chartStart.getTime(), prevStart.getTime()),
    );
    const all = await this.loadDays(userId, { gte: loadStart, lt: tomorrow });

    const between = (gte: Date, lt: Date) =>
      all.filter((d) => {
        const t = startOfDay(new Date(d.date)).getTime();
        return t >= gte.getTime() && t < lt.getTime();
      });

    const windowDays = between(windowStart, tomorrow);
    const previousDays = between(prevStart, windowStart);

    // 8 semaines glissantes, la courante (partielle) en dernier
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(chartStart.getTime() + i * 7 * 86_400_000);
      const end = new Date(start.getTime() + 7 * 86_400_000);
      const tracked = between(start, end).filter(isDayFullyTracked);
      return {
        start: ymd(start),
        score: tracked.length ? this.roundedAverage(tracked) : null,
        days: tracked.length,
      };
    });

    // Jour de semaine fort/faible — min 3 occurrences, écart ≥ 0,8 (même
    // seuil que l'ancien insight week-end, qu'il généralise).
    const byWeekday = new Map<number, Days[]>();
    for (const d of all.filter(isDayFullyTracked)) {
      const w = new Date(d.date).getUTCDay();
      byWeekday.set(w, [...(byWeekday.get(w) ?? []), d]);
    }
    const eligible = [...byWeekday.entries()]
      .filter(([, days]) => days.length >= 3)
      .map(([weekday, days]) => ({
        weekday,
        average: this.roundedAverage(days),
      }));
    let bestDay = null;
    let worstDay = null;
    if (eligible.length >= 2) {
      const sorted = [...eligible].sort((a, b) => b.average - a.average);
      if (sorted[0].average - sorted[sorted.length - 1].average >= 0.8) {
        bestDay = sorted[0];
        worstDay = sorted[sorted.length - 1];
      }
    }

    return {
      window: this.windowSummary(windowDays),
      previous: this.windowSummary(previousDays),
      repartition: this.mealRepartition(windowDays),
      weeks,
      bestDay,
      worstDay,
    };
  }

  private windowSummary(days: Days[]) {
    const tracked = days.filter(isDayFullyTracked);
    return {
      average: tracked.length ? this.roundedAverage(tracked) : 0,
      optimalDays: tracked.filter((d) => computeDayScore(d) >= 8).length,
      daysTracked: tracked.length,
    };
  }

  private roundedAverage(days: Days[]): number {
    return (
      Math.round(
        (days.reduce((s, d) => s + computeDayScore(d), 0) / days.length) * 10,
      ) / 10
    );
  }

  private mealRepartition(days: Days[]): Record<string, number> {
    const repartition = {
      'tres-leger': 0,
      leger: 0,
      normal: 0,
      copieux: 0,
      'tres-copieux': 0,
    };
    const keyFor: Record<string, keyof typeof repartition> = {
      tresLeger: 'tres-leger',
      leger: 'leger',
      normal: 'normal',
      copieux: 'copieux',
      tresCopieux: 'tres-copieux',
    };
    let total = 0;
    for (const d of days) {
      for (const slot of [
        d.morning_score,
        d.afternoon_score,
        d.evening_score,
      ]) {
        if (slot) {
          repartition[keyFor[slot]]++;
          total++;
        }
      }
    }
    if (total > 0) {
      (Object.keys(repartition) as (keyof typeof repartition)[]).forEach(
        (k) => {
          repartition[k] = Math.round((repartition[k] / total) * 100);
        },
      );
    }
    return repartition;
  }

  /** Lundi (UTC) de la semaine du jour donné. */
  private mondayOf(day: Date): Date {
    const offset = (day.getUTCDay() + 6) % 7;
    return new Date(day.getTime() - offset * 86_400_000);
  }

  async getStats(userId: number, monthParam?: string): Promise<StatsDto> {
    const target = this.parseMonth(monthParam);
    const nextMonth = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 1),
    );
    // Seul le mois demandé est chargé — les stats n'ont pas besoin de tout
    // l'historique (contrairement au streak record, cf. loadDays).
    const monthDays = await this.loadDays(userId, {
      gte: target,
      lt: nextMonth,
    });

    const tracked = monthDays.filter(isDayFullyTracked);
    const average = tracked.length
      ? Math.round(
          (tracked.reduce((s, d) => s + computeDayScore(d), 0) /
            tracked.length) *
            10,
        ) / 10
      : 0;
    const optimalDays = tracked.filter((d) => computeDayScore(d) >= 8).length;

    const repartition = {
      'tres-leger': 0,
      leger: 0,
      normal: 0,
      copieux: 0,
      'tres-copieux': 0,
    };
    const keyFor: Record<string, keyof typeof repartition> = {
      tresLeger: 'tres-leger',
      leger: 'leger',
      normal: 'normal',
      copieux: 'copieux',
      tresCopieux: 'tres-copieux',
    };
    let totalMeals = 0;
    for (const d of monthDays) {
      for (const slot of [
        d.morning_score,
        d.afternoon_score,
        d.evening_score,
      ]) {
        if (slot) {
          repartition[keyFor[slot]]++;
          totalMeals++;
        }
      }
    }
    if (totalMeals > 0) {
      (Object.keys(repartition) as (keyof typeof repartition)[]).forEach(
        (k) => {
          repartition[k] = Math.round((repartition[k] / totalMeals) * 100);
        },
      );
    }

    // Weekly trend: groups days of the month by ISO week number
    const buckets = new Map<number, { sum: number; n: number }>();
    for (const d of tracked) {
      const w = this.weekNumber(new Date(d.date));
      const bucket = buckets.get(w) ?? { sum: 0, n: 0 };
      bucket.sum += computeDayScore(d);
      bucket.n += 1;
      buckets.set(w, bucket);
    }
    const weeklyTrend = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([w, b]) => ({
        week: `S${w}`,
        score: Math.round((b.sum / b.n) * 10) / 10,
      }));

    // Insight: weekend vs weekday
    const weekend = tracked.filter((d) => {
      const day = new Date(d.date).getUTCDay();
      return day === 0 || day === 6;
    });
    const weekday = tracked.filter((d) => {
      const day = new Date(d.date).getUTCDay();
      return day !== 0 && day !== 6;
    });
    let insight = null;
    if (weekend.length >= 2 && weekday.length >= 2) {
      const we =
        weekend.reduce((s, d) => s + computeDayScore(d), 0) / weekend.length;
      const wd =
        weekday.reduce((s, d) => s + computeDayScore(d), 0) / weekday.length;
      if (Math.abs(we - wd) >= 0.8) {
        insight = {
          headline:
            we < wd
              ? 'Tes weekends tirent ta note vers le bas'
              : 'Tes weekends sont tes meilleurs jours',
          body: `Score moyen weekend : ${this.fmt(we)} · semaine : ${this.fmt(wd)}`,
        };
      }
    }

    return { average, optimalDays, repartition, weeklyTrend, insight };
  }

  // Sans fenêtre, charge tout l'historique : streak/records/badges en ont
  // réellement besoin (le record de flamme est un max sur la vie entière).
  // Compromis assumé tant que les historiques restent petits (~quelques
  // centaines de jours) ; à revoir si un historique dépasse plusieurs années.
  private async loadDays(
    userId: number,
    dateWindow?: { gte: Date; lt: Date },
  ): Promise<Days[]> {
    return this.prisma.days.findMany({
      where: { user_id: userId, ...(dateWindow && { date: dateWindow }) },
      orderBy: { date: 'asc' },
    });
  }

  private weekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );
  }

  private parseMonth(input?: string): Date {
    if (input && /^\d{4}-\d{2}$/.test(input)) {
      const [y, m] = input.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, 1));
    }
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  }

  private fmt(n: number): string {
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
  }
}
