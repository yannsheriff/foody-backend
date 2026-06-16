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
  it('has 16 unique ids, 4 per level', () => {
    expect(CHALLENGE_CATALOG).toHaveLength(16);
    expect(new Set(CHALLENGE_CATALOG.map((c) => c.id)).size).toBe(16);
    for (const lvl of [1, 2, 3, 4]) {
      expect(CHALLENGE_CATALOG.filter((c) => c.level === lvl)).toHaveLength(4);
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

describe('leftLabel', () => {
  it('pluralizes days and sessions', () => {
    expect(leftLabel(def('saisie-7'), 5)).toBe('Encore 2 jours');
    expect(leftLabel(def('saisie-7'), 6)).toBe('Encore 1 jour');
    expect(leftLabel(def('sport-3-semaine'), 1)).toBe('Encore 2 séances');
    expect(leftLabel(def('sport-3-semaine'), 2)).toBe('Encore 1 séance');
  });
});
