import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Days } from '@prisma/client';
import {
  computeDayScore,
  diffDays,
  isDayFullyTracked,
  startOfDay,
  ymd,
} from './insights.scoring';
import { BADGES, CHALLENGES } from './insights.constants';
import { StreakDto } from './dto/streak.dto';
import { RecordsDto } from './dto/records.dto';
import { ChallengeDto, ChallengesResponseDto } from './dto/challenge.dto';
import { BadgeDto } from './dto/badge.dto';
import { StatsDto } from './dto/stats.dto';

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async getStreak(userId: number): Promise<StreakDto> {
    const days = await this.loadDays(userId);
    const sorted = [...days].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const today = startOfDay(new Date());
    const yesterday = new Date(today.getTime() - 86_400_000);

    let current = 0;
    let cursor: Date | null = null;
    // Streak starts at most recent fully-tracked day that is today or yesterday
    const head = sorted.find((d) => isDayFullyTracked(d));
    if (head) {
      const headDate = startOfDay(new Date(head.date));
      if (
        headDate.getTime() === today.getTime() ||
        headDate.getTime() === yesterday.getTime()
      ) {
        cursor = headDate;
        for (const d of sorted) {
          const date = startOfDay(new Date(d.date));
          if (
            cursor &&
            date.getTime() === cursor.getTime() &&
            isDayFullyTracked(d)
          ) {
            current++;
            cursor = new Date(cursor.getTime() - 86_400_000);
          } else if (date.getTime() < cursor!.getTime()) {
            break;
          }
        }
      }
    }

    const record = this.computeRecordStreak(sorted);
    const last = sorted.find((d) => isDayFullyTracked(d));
    return {
      current,
      record,
      lastFilledDate: last ? ymd(new Date(last.date)) : null,
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
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
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
      streakRecord: this.computeRecordStreak(
        [...days].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      ),
      monthAverage,
    };
  }

  async getChallenges(userId: number): Promise<ChallengesResponseDto> {
    const days = await this.loadDays(userId);
    const now = new Date();
    const monthStart = startOfDay(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const weekStart = this.startOfWeek(now);

    const active: ChallengeDto[] = [];
    const upcoming: ChallengeDto[] = [];
    const completed: ChallengeDto[] = [];

    for (const def of CHALLENGES) {
      const window = days.filter((d) => {
        const date = new Date(d.date);
        return date >= (def.type === 'weekly' ? weekStart : monthStart);
      });
      const progress = def.progress(window);
      const card: ChallengeDto = {
        id: def.id,
        title: def.title,
        type: def.type,
        typeLabel:
          def.type === 'monthly'
            ? `${def.typeLabel} · ${this.monthLabel(now)}`
            : `${def.typeLabel} · S${this.weekNumber(now)}`,
        icon: def.icon,
        progress,
        total: def.total,
        leftLabel: def.leftLabel(progress, def.total),
        status:
          progress >= def.total
            ? 'completed'
            : progress > 0
              ? 'active'
              : 'upcoming',
        subtitle: def.subtitle,
      };
      if (card.status === 'completed') completed.push(card);
      else if (card.status === 'active') active.push(card);
      else upcoming.push(card);
    }

    return { active, upcoming, completed };
  }

  async getBadges(userId: number): Promise<BadgeDto[]> {
    const days = await this.loadDays(userId);
    return BADGES.map((b) => ({
      id: b.id,
      title: b.title,
      emoji: b.emoji,
      unlocked: b.unlock(days),
    }));
  }

  async getStats(userId: number, monthParam?: string): Promise<StatsDto> {
    const days = await this.loadDays(userId);
    const target = this.parseMonth(monthParam);
    const monthDays = days.filter((d) => {
      const date = new Date(d.date);
      return (
        date.getFullYear() === target.getFullYear() &&
        date.getMonth() === target.getMonth()
      );
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
      const day = new Date(d.date).getDay();
      return day === 0 || day === 6;
    });
    const weekday = tracked.filter((d) => {
      const day = new Date(d.date).getDay();
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

  private async loadDays(userId: number): Promise<Days[]> {
    return this.prisma.days.findMany({
      where: { user_id: userId },
      orderBy: { date: 'asc' },
    });
  }

  private computeRecordStreak(sortedDesc: Days[]): number {
    let max = 0;
    let current = 0;
    let prev: Date | null = null;
    for (const d of sortedDesc) {
      const date = startOfDay(new Date(d.date));
      if (!isDayFullyTracked(d)) {
        current = 0;
        prev = date;
        continue;
      }
      if (prev && diffDays(prev, date) !== 1) {
        current = 0;
      }
      current++;
      if (current > max) max = current;
      prev = date;
    }
    return max;
  }

  private startOfWeek(date: Date): Date {
    const d = startOfDay(date);
    const day = d.getDay();
    const offset = day === 0 ? 6 : day - 1; // Monday-first
    d.setDate(d.getDate() - offset);
    return d;
  }

  private weekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
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
      return new Date(y, m - 1, 1);
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  }

  private monthLabel(date: Date): string {
    return [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ][date.getMonth()];
  }

  private fmt(n: number): string {
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
  }
}
