import { Days } from '@prisma/client';
import { startOfDay } from '../insights/insights.scoring';
import {
  CHALLENGE_CATALOG,
  ChallengeDef,
  challengeById,
} from './challenges.constants';
import {
  SNACK_THRESHOLD,
  computeChallengeProgress,
  leftLabel,
} from './challenges.progress';

const today = startOfDay(new Date());

// dayAt(0) = today, dayAt(1) = yesterday, ...
function dayAt(offset: number): Date {
  return new Date(today.getTime() - offset * 86_400_000);
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
    sport_level: null,
    sport_type: null,
    meals_completed_at: null,
    ...over,
  } as Days;
}

function def(id: string): ChallengeDef {
  const found = challengeById(id);
  if (!found) throw new Error(`unknown id ${id}`);
  return found;
}

describe('catalog', () => {
  it('has 28 unique ids, 7 per level', () => {
    expect(CHALLENGE_CATALOG).toHaveLength(28);
    expect(new Set(CHALLENGE_CATALOG.map((c) => c.id)).size).toBe(28);
    for (const lvl of [1, 2, 3, 4]) {
      expect(CHALLENGE_CATALOG.filter((c) => c.level === lvl)).toHaveLength(7);
    }
  });
});

describe('saisie (consecutive fully-tracked days)', () => {
  const saisie3 = def('saisie-3');

  it('completes once N consecutive tracked days are fully elapsed (≤ yesterday)', () => {
    const days = [1, 2, 3].map((o) => mkDay({ date: dayAt(o) }));
    const { prog, done } = computeChallengeProgress(saisie3, days, dayAt(3));
    expect(prog).toBe(3);
    expect(done).toBe(true);
  });

  it('a run reaching the target only by counting today is not done yet', () => {
    // J-0/J-1/J-2 tracked: full progress, but the final day (today) is not
    // over → validated at midnight, so done stays false until tomorrow.
    const days = [0, 1, 2].map((o) => mkDay({ date: dayAt(o) }));
    const { prog, done } = computeChallengeProgress(saisie3, days, dayAt(2));
    expect(prog).toBe(3);
    expect(done).toBe(false);
  });

  it('resets on a missed day before today', () => {
    // J-2 missing: only J-1 + today count
    const days = [0, 1, 3].map((o) => mkDay({ date: dayAt(o) }));
    const { prog, done } = computeChallengeProgress(saisie3, days, dayAt(3));
    expect(prog).toBe(2);
    expect(done).toBe(false);
  });

  it('an incomplete today does not reset the run', () => {
    const days = [
      mkDay({ date: dayAt(0), evening_score: null }), // today, dinner pending
      mkDay({ date: dayAt(1) }),
      mkDay({ date: dayAt(2) }),
    ];
    const { prog } = computeChallengeProgress(def('saisie-7'), days, dayAt(2));
    expect(prog).toBe(2);
  });

  it('ignores days before started_at', () => {
    const days = [0, 1, 2, 3, 4].map((o) => mkDay({ date: dayAt(o) }));
    const { prog } = computeChallengeProgress(def('saisie-7'), days, dayAt(1));
    expect(prog).toBe(2);
  });

  it('counts the start day itself', () => {
    const days = [mkDay({ date: dayAt(0) })];
    const { prog } = computeChallengeProgress(saisie3, days, dayAt(0));
    expect(prog).toBe(1);
  });

  it('duplicate rows for the same date do not break a run', () => {
    const days = [
      mkDay({ date: dayAt(1) }),
      mkDay({ date: dayAt(2), morning_score: null }), // empty duplicate
      mkDay({ date: dayAt(2) }),
      mkDay({ date: dayAt(3) }),
    ];
    const { done } = computeChallengeProgress(saisie3, days, dayAt(3));
    expect(done).toBe(true);
  });
});

describe('copieux (consecutive days without heavy meals)', () => {
  it('a heavy meal before today resets the run', () => {
    const days = [
      mkDay({ date: dayAt(0) }),
      mkDay({ date: dayAt(1), evening_score: 'copieux' }),
      mkDay({ date: dayAt(2) }),
      mkDay({ date: dayAt(3) }),
    ];
    const { prog } = computeChallengeProgress(def('copieux-5'), days, dayAt(3));
    expect(prog).toBe(1);
  });
});

describe('grignotage (snack below threshold)', () => {
  const grignotage3 = def('grignotage-3');

  it('snack just under the threshold qualifies, at it fails', () => {
    const under = [1, 2, 3].map((o) =>
      mkDay({ date: dayAt(o), snack: SNACK_THRESHOLD - 0.01 }),
    );
    expect(computeChallengeProgress(grignotage3, under, dayAt(3)).done).toBe(
      true,
    );

    const at = [
      mkDay({ date: dayAt(0), snack: 0 }),
      mkDay({ date: dayAt(1), snack: SNACK_THRESHOLD }),
      mkDay({ date: dayAt(2), snack: 0 }),
    ];
    expect(computeChallengeProgress(grignotage3, at, dayAt(2)).prog).toBe(1);
  });

  it('a null snack does not qualify', () => {
    const days = [mkDay({ date: dayAt(0), snack: null })];
    expect(computeChallengeProgress(grignotage3, days, dayAt(0)).prog).toBe(0);
  });
});

describe('note (consecutive days at/above minScore)', () => {
  const note63 = def('note-6-3');

  it('a day scoring exactly the minimum qualifies', () => {
    // leger+normal+leger = 6.0, no sport, snack=1 → exactly 6
    const days = [1, 2, 3].map((o) => mkDay({ date: dayAt(o), snack: 1 }));
    const { done } = computeChallengeProgress(note63, days, dayAt(3));
    expect(done).toBe(true);
  });

  it('a low-scoring day before today resets', () => {
    const days = [
      mkDay({ date: dayAt(0) }),
      mkDay({
        date: dayAt(1),
        morning_score: 'tresCopieux',
        afternoon_score: 'tresCopieux',
        evening_score: 'tresCopieux',
        snack: 1,
      }),
      mkDay({ date: dayAt(2) }),
    ];
    const { prog } = computeChallengeProgress(note63, days, dayAt(2));
    expect(prog).toBe(1);
  });
});

describe('sport (sessions within a rolling window)', () => {
  const sport3 = def('sport-3-semaine'); // 3 séances / 7 jours

  it('3 sessions within 7 days completes once the window is elapsed', () => {
    const days = [1, 3, 6].map((o) =>
      mkDay({ date: dayAt(o), sport_level: 'normal' }),
    );
    const { prog, done } = computeChallengeProgress(sport3, days, dayAt(6));
    expect(prog).toBe(3);
    expect(done).toBe(true);
  });

  it('a window completed only by counting today is full but not done yet', () => {
    // sessions J-0/J-1/J-2: window full, but the last session lands today →
    // validated at midnight, so done stays false until tomorrow.
    const days = [0, 1, 2].map((o) =>
      mkDay({ date: dayAt(o), sport_level: 'normal' }),
    );
    const { prog, done } = computeChallengeProgress(sport3, days, dayAt(2));
    expect(prog).toBe(3);
    expect(done).toBe(false);
  });

  it('3 sessions spread over 8 days does not complete', () => {
    const days = [0, 4, 7].map((o) =>
      mkDay({ date: dayAt(o), sport_level: 'normal' }),
    );
    const { prog, done } = computeChallengeProgress(sport3, days, dayAt(7));
    expect(done).toBe(false);
    // trailing 7-day window only holds the J-0 and J-4 sessions
    expect(prog).toBe(2);
  });

  it('a past in-window success stays done even after the window slides', () => {
    // sessions J-20/J-18/J-16 (within 7 days), nothing since
    const days = [16, 18, 20].map((o) =>
      mkDay({ date: dayAt(o), sport_level: 'normal' }),
    );
    const { prog, done } = computeChallengeProgress(sport3, days, dayAt(20));
    expect(done).toBe(true);
    expect(prog).toBe(3);
  });

  it('sessions before started_at are ignored', () => {
    const days = [0, 1, 2].map((o) =>
      mkDay({ date: dayAt(o), sport_level: 'normal' }),
    );
    const { prog } = computeChallengeProgress(sport3, days, dayAt(1));
    expect(prog).toBe(2);
  });
});

describe('soir-leger (consecutive light dinners)', () => {
  const soir3 = def('soir-leger-3');

  it('completes after 3 elapsed light dinners', () => {
    // mkDay default evening is leger
    const days = [1, 2, 3].map((o) => mkDay({ date: dayAt(o) }));
    const { prog, done } = computeChallengeProgress(soir3, days, dayAt(3));
    expect(prog).toBe(3);
    expect(done).toBe(true);
  });

  it('a normal dinner before today resets the run', () => {
    const days = [
      mkDay({ date: dayAt(0) }),
      mkDay({ date: dayAt(1), evening_score: 'normal' }),
      mkDay({ date: dayAt(2) }),
    ];
    const { prog } = computeChallengeProgress(soir3, days, dayAt(2));
    expect(prog).toBe(1);
  });

  it('an unlogged dinner does not qualify', () => {
    const days = [mkDay({ date: dayAt(0), evening_score: null })];
    expect(computeChallengeProgress(soir3, days, dayAt(0)).prog).toBe(0);
  });
});

describe('weekend (qualifying Sat+Sun pairs)', () => {
  // Dates fixes UTC — 2026-07-04 est un samedi.
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const START = d('2026-07-01'); // mercredi
  const SAT = '2026-07-04';
  const SUN = '2026-07-05';
  const weekend1 = def('weekend-1');

  // mkDay default = leger/normal/leger + snack 0 → score 8 (≥ 6.5)
  const okDay = (iso: string) => mkDay({ date: d(iso) });

  it('a full qualifying weekend counts and completes once Sunday is elapsed', () => {
    const days = [okDay(SAT), okDay(SUN)];
    const monday = d('2026-07-06');
    const { prog, done } = computeChallengeProgress(
      weekend1,
      days,
      START,
      monday,
    );
    expect(prog).toBe(1);
    expect(done).toBe(true);
  });

  it('the in-progress weekend shows but is not done while Sunday is today', () => {
    const days = [okDay(SAT), okDay(SUN)];
    const sunday = d(SUN);
    const { prog, done } = computeChallengeProgress(
      weekend1,
      days,
      START,
      sunday,
    );
    expect(prog).toBe(1);
    expect(done).toBe(false);
  });

  it('Saturday alone does not make a weekend', () => {
    const days = [okDay(SAT)];
    const monday = d('2026-07-06');
    expect(computeChallengeProgress(weekend1, days, START, monday).prog).toBe(
      0,
    );
  });

  it('a weekend day under the minimum score disqualifies the pair', () => {
    // snack 1 → score 6.0 < 6.5
    const days = [okDay(SAT), mkDay({ date: d(SUN), snack: 1 })];
    const monday = d('2026-07-06');
    expect(computeChallengeProgress(weekend1, days, START, monday).prog).toBe(
      0,
    );
  });

  it('windowed variant needs the weekends to fit the window', () => {
    const weekend3 = def('weekend-3-mois'); // 3 week-ends / 30 jours
    const within = [
      '2026-07-04',
      '2026-07-05',
      '2026-07-11',
      '2026-07-12',
      '2026-07-18',
      '2026-07-19',
    ].map(okDay);
    const after = d('2026-07-20');
    const res = computeChallengeProgress(weekend3, within, START, after);
    expect(res.prog).toBe(3);
    expect(res.done).toBe(true);

    // 3 week-ends étalés sur bien plus de 30 jours → pas validé
    const spread = [
      '2026-07-04',
      '2026-07-05',
      '2026-08-15',
      '2026-08-16',
      '2026-09-26',
      '2026-09-27',
    ].map(okDay);
    const late = d('2026-09-28');
    expect(computeChallengeProgress(weekend3, spread, START, late).done).toBe(
      false,
    );
  });
});

describe('leftLabel', () => {
  it('pluralizes days and sessions', () => {
    expect(leftLabel(def('saisie-7'), 5)).toBe('Encore 2 jours');
    expect(leftLabel(def('saisie-7'), 6)).toBe('Encore 1 jour');
    expect(leftLabel(def('sport-3-semaine'), 1)).toBe('Encore 2 séances');
    expect(leftLabel(def('sport-3-semaine'), 2)).toBe('Encore 1 séance');
    expect(leftLabel(def('weekend-3-mois'), 1)).toBe('Encore 2 week-ends');
    expect(leftLabel(def('soir-leger-5'), 4)).toBe('Encore 1 soir');
  });
});
