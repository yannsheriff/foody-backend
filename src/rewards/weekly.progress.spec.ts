import { Days } from '@prisma/client';
import { weeklyById, WeeklyChallengeDef } from './weekly-catalog.constants';
import {
  countQualifyingDays,
  daysLeftInWeek,
  isoWeekOf,
  proratedTarget,
  qualifiesWeekly,
  resolveWeekly,
  weekBounds,
} from './weekly.progress';

const WEEK = weekBounds(new Date(Date.UTC(2026, 6, 22))); // week containing 22 Jul 2026
const def = (id: string): WeeklyChallengeDef => {
  const d = weeklyById(id);
  if (!d) throw new Error(`unknown ${id}`);
  return d;
};

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
    sport_level: null,
    sport_type: null,
    meals_completed_at: null,
    ...over,
  } as Days;
}
// Day at weekday offset from Monday (0=Mon … 6=Sun), stamped at noon UTC.
function weekDay(offset: number): Date {
  return new Date(WEEK.weekStart.getTime() + offset * 86_400_000 + 12 * 3_600_000);
}

describe('weekBounds', () => {
  it('gives Monday 00:00 → Sunday 23:59:59 UTC and an ISO week key', () => {
    expect(WEEK.weekStart.getUTCDay()).toBe(1); // Monday
    expect(WEEK.weekStart.getUTCHours()).toBe(0);
    expect(WEEK.weekEnd.getUTCDay()).toBe(0); // Sunday
    expect(WEEK.isoWeek).toMatch(/^\d{4}-W\d{2}$/);
    // start and end are in the same ISO week
    expect(isoWeekOf(WEEK.weekEnd)).toBe(WEEK.isoWeek);
  });
});

describe('daysLeftInWeek', () => {
  it('is 7 on Monday and 1 on Sunday (today included)', () => {
    expect(daysLeftInWeek(WEEK.weekStart)).toBe(7);
    expect(daysLeftInWeek(new Date(WEEK.weekEnd))).toBe(1);
    expect(daysLeftInWeek(weekDay(3))).toBe(4); // Thursday
  });
});

describe('proratedTarget', () => {
  it('scales the base target to the days left, min 1', () => {
    expect(proratedTarget(7, 7)).toBe(7);
    expect(proratedTarget(5, 4)).toBe(3); // round(20/7)
    expect(proratedTarget(3, 1)).toBe(1); // round(3/7)=0 → clamped to 1
  });
});

describe('countQualifyingDays', () => {
  it('counts distinct qualifying days across the week', () => {
    const days = [weekDay(0), weekDay(1), weekDay(2)].map((date) => mkDay({ date }));
    expect(countQualifyingDays(def('w-saisie-3'), days, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(3);
  });

  it('dedupes multiple rows on the same day', () => {
    const days = [mkDay({ date: weekDay(0) }), mkDay({ date: weekDay(0) })];
    expect(countQualifyingDays(def('w-saisie-3'), days, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(1);
  });

  it('does not count days after `now` (clamp), today included', () => {
    const days = [weekDay(0), weekDay(1), weekDay(4)].map((date) => mkDay({ date }));
    // now = Wednesday (offset 2): only Mon + Tue count, Friday is in the future
    expect(countQualifyingDays(def('w-saisie-5'), days, WEEK.weekStart, WEEK.weekEnd, weekDay(2))).toBe(2);
  });

  it('sport counts only normal/intense days', () => {
    const days = [
      mkDay({ date: weekDay(0), sport_level: 'normal' }),
      mkDay({ date: weekDay(1), sport_level: 'intense' }),
      mkDay({ date: weekDay(2), sport_level: null }),
    ];
    expect(countQualifyingDays(def('w-sport-2'), days, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(2);
  });

  it('grignotage requires snack below the threshold', () => {
    const days = [
      mkDay({ date: weekDay(0), snack: 0 }),
      mkDay({ date: weekDay(1), snack: 0.5 }),
    ];
    expect(countQualifyingDays(def('w-grignotage-3'), days, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(1);
  });
});

describe('countQualifyingDays · weekend', () => {
  const clean = def('w-weekend-clean');
  it('needs both Saturday and Sunday to qualify', () => {
    const both = [mkDay({ date: weekDay(5) }), mkDay({ date: weekDay(6) })];
    expect(countQualifyingDays(clean, both, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(1);
    const satOnly = [mkDay({ date: weekDay(5) })];
    expect(countQualifyingDays(clean, satOnly, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(0);
  });
});

describe('resolveWeekly', () => {
  it('wins when the count reaches the target', () => {
    const days = [0, 1, 2, 3, 4].map((o) => mkDay({ date: weekDay(o) }));
    expect(resolveWeekly(def('w-saisie-5'), 5, days, WEEK.weekStart, WEEK.weekEnd).won).toBe(true);
  });
  it('loses when it falls short', () => {
    const days = [0, 1, 2, 3].map((o) => mkDay({ date: weekDay(o) }));
    const r = resolveWeekly(def('w-saisie-5'), 5, days, WEEK.weekStart, WEEK.weekEnd);
    expect(r.won).toBe(false);
    expect(r.prog).toBe(4);
  });
  it('honours a prorated target', () => {
    const days = [0, 1, 2].map((o) => mkDay({ date: weekDay(o) }));
    // base 5, chosen with 4 days left → target 3, met by 3 qualifying days
    expect(resolveWeekly(def('w-saisie-5'), proratedTarget(5, 4), days, WEEK.weekStart, WEEK.weekEnd).won).toBe(true);
  });
});

describe('qualifiesWeekly · note threshold', () => {
  it('respects the per-day minScore', () => {
    const heavy = mkDay({
      date: weekDay(0),
      morning_score: 'copieux',
      afternoon_score: 'copieux',
      evening_score: 'copieux',
      snack: 1,
    });
    expect(qualifiesWeekly(def('w-note-8-3'), heavy)).toBe(false);
    const light = mkDay({ date: weekDay(0) }); // default day scores 8.0
    expect(qualifiesWeekly(def('w-note-8-3'), light)).toBe(true);
  });
});

describe('nouvelles mécaniques', () => {
  it('parfait : 3 repas sans copieux + sport + zéro grignotage', () => {
    // base mkDay = leger/normal/leger, snack 0 → il ne manque que le sport
    expect(qualifiesWeekly(def('w-parfait-1'), mkDay({ date: weekDay(0), sport_level: 'intense' }))).toBe(true);
    expect(qualifiesWeekly(def('w-parfait-1'), mkDay({ date: weekDay(0), sport_level: null }))).toBe(false);
    expect(qualifiesWeekly(def('w-parfait-1'), mkDay({ date: weekDay(0), sport_level: 'intense', evening_score: 'copieux' }))).toBe(false);
    expect(qualifiesWeekly(def('w-parfait-1'), mkDay({ date: weekDay(0), sport_level: 'intense', snack: 0.5 }))).toBe(false);
  });

  it('combo : sport ET dîner léger le même jour', () => {
    expect(qualifiesWeekly(def('w-combo-2'), mkDay({ date: weekDay(0), sport_level: 'normal', evening_score: 'leger' }))).toBe(true);
    expect(qualifiesWeekly(def('w-combo-2'), mkDay({ date: weekDay(0), sport_level: null, evening_score: 'leger' }))).toBe(false);
    expect(qualifiesWeekly(def('w-combo-2'), mkDay({ date: weekDay(0), sport_level: 'normal', evening_score: 'copieux' }))).toBe(false);
  });

  it('volume : compte les repas légers, pas les jours', () => {
    const days = [
      mkDay({ date: weekDay(0), morning_score: 'leger', afternoon_score: 'leger', evening_score: 'leger' }), // 3 légers
      mkDay({ date: weekDay(1), morning_score: 'leger', afternoon_score: 'normal', evening_score: 'copieux' }), // 1 léger
    ];
    expect(countQualifyingDays(def('w-volume-5'), days, WEEK.weekStart, WEEK.weekEnd, WEEK.weekEnd)).toBe(4);
  });
});
