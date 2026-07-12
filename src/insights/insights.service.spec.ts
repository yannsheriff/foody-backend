import { Days } from '@prisma/client';
import { InsightsService } from './insights.service';
import { startOfDay } from './insights.scoring';

const today = startOfDay(new Date());

// dayAt(0) = today, dayAt(1) = yesterday, ...
function dayAt(offset: number): Date {
  return new Date(today.getTime() - offset * 86_400_000);
}

// On-time stamp: noon on the day itself.
function sameDayNoon(date: Date): Date {
  return new Date(date.getTime() + 12 * 3_600_000);
}

let nextId = 1;
function mkDay(over: Partial<Days> & { date: Date }): Days {
  return {
    id: nextId++,
    user_id: 1,
    morning_score: 'leger',
    afternoon_score: 'normal',
    evening_score: 'leger',
    snack: 0,
    sport: false,
    sport_type: null,
    meals_completed_at: null,
    ...over,
  } as Days;
}

function mkService(days: Days[]): InsightsService {
  const prisma = {
    days: { findMany: jest.fn().mockResolvedValue(days) },
  };
  return new InsightsService(prisma as never);
}

describe('InsightsService.getStreak', () => {
  it('counts consecutive on-time days ending today', async () => {
    const days = [0, 1, 2].map((o) =>
      mkDay({ date: dayAt(o), meals_completed_at: sameDayNoon(dayAt(o)) }),
    );
    const { current } = await mkService(days).getStreak(1);
    expect(current).toBe(3);
  });

  it('preserves grandfathered streaks (null timestamps)', async () => {
    const days = [1, 2, 3, 4].map((o) => mkDay({ date: dayAt(o) }));
    const { current } = await mkService(days).getStreak(1);
    expect(current).toBe(4);
  });

  it('does not resurrect a streak from backfilled days', async () => {
    // User tracked J-7..J-4 on time, skipped J-3..J-1, backfilled all 3 today.
    const backfilledAt = sameDayNoon(dayAt(0));
    const days = [
      ...[4, 5, 6, 7].map((o) =>
        mkDay({ date: dayAt(o), meals_completed_at: sameDayNoon(dayAt(o)) }),
      ),
      ...[1, 2, 3].map((o) =>
        mkDay({ date: dayAt(o), meals_completed_at: backfilledAt }),
      ),
    ];
    const { current } = await mkService(days).getStreak(1);
    // J-1 filled today is within grace and counts; J-2/J-3 are late and the
    // old chain must not reconnect.
    expect(current).toBe(1);
  });

  it('breaks the current streak at a late-filled day', async () => {
    const days = [
      mkDay({ date: dayAt(0), meals_completed_at: sameDayNoon(dayAt(0)) }),
      // yesterday filled two days after its date
      mkDay({ date: dayAt(1), meals_completed_at: sameDayNoon(dayAt(0)) }),
      mkDay({ date: dayAt(2), meals_completed_at: sameDayNoon(dayAt(2)) }),
    ];
    // dayAt(1) completed at dayAt(0) noon is within grace — push it later:
    days[1].meals_completed_at = new Date(
      dayAt(0).getTime() + 23 * 3_600_000 + 45 * 60_000,
    );
    const { current } = await mkService(days).getStreak(1);
    expect(current).toBe(1);
  });

  it('excludes late days from the record', async () => {
    // Historical run J-20..J-11 with J-15 backfilled late → 5 + 4.
    const days = Array.from({ length: 10 }, (_, i) => {
      const o = 11 + i;
      const late = o === 15;
      return mkDay({
        date: dayAt(o),
        meals_completed_at: late
          ? sameDayNoon(dayAt(o - 5))
          : sameDayNoon(dayAt(o)),
      });
    });
    const { record, current } = await mkService(days).getStreak(1);
    expect(record).toBe(5);
    expect(current).toBe(0);
  });
});

describe('InsightsService.getRecords / getStats', () => {
  it('still counts late-filled days everywhere except streak', async () => {
    const lateDay = mkDay({
      date: dayAt(3),
      meals_completed_at: sameDayNoon(dayAt(0)),
    });
    const onTime = mkDay({
      date: dayAt(1),
      meals_completed_at: sameDayNoon(dayAt(1)),
    });
    const service = mkService([lateDay, onTime]);
    const records = await service.getRecords(1);
    expect(records.daysTracked).toBe(2);
    expect(records.streakRecord).toBe(1);
  });
});

describe('InsightsService.getOverview', () => {
  it('sépare la fenêtre 30 j et les 30 jours précédents', async () => {
    // 5 jours récents parfaits (légers, sport) vs 5 anciens copieux
    const recent = [0, 1, 2, 3, 4].map((o) =>
      mkDay({ date: dayAt(o), snack: 0, sport_level: 'normal' }),
    );
    const older = [35, 36, 37, 38, 39].map((o) =>
      mkDay({
        date: dayAt(o),
        morning_score: 'copieux',
        afternoon_score: 'copieux',
        evening_score: 'copieux',
        snack: 1,
      }),
    );
    const o = await mkService([...recent, ...older]).getOverview(1);
    expect(o.window.daysTracked).toBe(5);
    expect(o.previous.daysTracked).toBe(5);
    expect(o.window.average).toBeGreaterThan(o.previous.average);
  });

  it('renvoie toujours 8 semaines, la courante en dernier, trous à null', async () => {
    const o = await mkService([mkDay({ date: dayAt(0) })]).getOverview(1);
    expect(o.weeks).toHaveLength(8);
    const last = o.weeks[o.weeks.length - 1];
    expect(last.score).not.toBeNull();
    expect(o.weeks[0].score).toBeNull();
    // les lundis se suivent de 7 jours
    const starts = o.weeks.map((w) =>
      new Date(w.start + 'T00:00:00Z').getTime(),
    );
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBe(7 * 86_400_000);
    }
  });

  it('jour fort/faible : min 3 occurrences et écart ≥ 0,8, sinon null', async () => {
    // 3 lundis légers, 3 mardis copieux — écart net
    const monday = new Date(
      today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000,
    );
    const mk = (base: Date, weeksBack: number, over: Partial<Days>) =>
      mkDay({
        date: new Date(base.getTime() - weeksBack * 7 * 86_400_000),
        ...over,
      });
    const tuesday = new Date(monday.getTime() + 86_400_000);
    const light = { snack: 0 } as Partial<Days>;
    const heavy = {
      morning_score: 'copieux',
      afternoon_score: 'copieux',
      evening_score: 'copieux',
      snack: 1,
    } as Partial<Days>;
    const days = [
      mk(monday, 1, light),
      mk(monday, 2, light),
      mk(monday, 3, light),
      mk(tuesday, 1, heavy),
      mk(tuesday, 2, heavy),
      mk(tuesday, 3, heavy),
    ];
    const o = await mkService(days).getOverview(1);
    expect(o.bestDay?.weekday).toBe(1); // lundi UTC
    expect(o.worstDay?.weekday).toBe(2); // mardi UTC
    // 2 occurrences seulement → pas d'insight
    const few = [mk(monday, 1, light), mk(tuesday, 1, heavy)];
    const o2 = await mkService(few).getOverview(1);
    expect(o2.bestDay).toBeNull();
    expect(o2.worstDay).toBeNull();
  });
});
