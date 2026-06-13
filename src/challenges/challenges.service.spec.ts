import { Days, UserChallenge } from '@prisma/client';
import { ChallengesService } from './challenges.service';
import { startOfDay } from '../insights/insights.scoring';

const today = startOfDay(new Date());

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
    sport_type: null,
    meals_completed_at: null,
    ...over,
  } as Days;
}

function mkRow(over: Partial<UserChallenge>): UserChallenge {
  return {
    id: nextId++,
    user_id: 1,
    challenge_id: 'saisie-3',
    status: 'active',
    started_at: dayAt(0),
    completed_at: null,
    ...over,
  } as UserChallenge;
}

interface PrismaMock {
  days: { findMany: jest.Mock };
  userChallenge: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
}

function mkService(
  days: Days[],
  rows: UserChallenge[],
): { service: ChallengesService; prisma: PrismaMock } {
  const prisma: PrismaMock = {
    days: { findMany: jest.fn().mockResolvedValue(days) },
    userChallenge: {
      findMany: jest.fn().mockResolvedValue(rows),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve(mkRow({ ...data, started_at: new Date() })),
        ),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({
          ...rows.find((r) => r.id === where.id),
          ...data,
        }),
      ),
    },
  };
  return { service: new ChallengesService(prisma as never), prisma };
}

const level1Done = ['saisie-3', 'grignotage-3', 'note-6-3', 'sport-2-semaine'];

describe('ChallengesService.getHub', () => {
  it('fresh user: no active, level 1 current with 4 todo, 2-4 locked', async () => {
    const { service } = mkService([], []);
    const hub = await service.getHub(1);
    expect(hub.active).toBeNull();
    expect(hub.levels.map((l) => l.state)).toEqual([
      'current',
      'locked',
      'locked',
      'locked',
    ]);
    expect(hub.levels[0].items.map((i) => i.state)).toEqual(
      Array(4).fill('todo'),
    );
    expect(hub.levels[1].items.map((i) => i.state)).toEqual(
      Array(4).fill('locked'),
    );
  });

  it('level 1 fully completed unlocks level 2', async () => {
    const rows = level1Done.map((id) =>
      mkRow({ challenge_id: id, status: 'completed', completed_at: dayAt(3) }),
    );
    const { service } = mkService([], rows);
    const hub = await service.getHub(1);
    expect(hub.levels.map((l) => l.state)).toEqual([
      'done',
      'current',
      'locked',
      'locked',
    ]);
    expect(hub.levels[0].items.every((i) => i.state === 'done')).toBe(true);
    expect(hub.levels[0].items[0].completedAt).toBeDefined();
  });

  it('exposes the active challenge with progress and left label', async () => {
    const days = [0, 1].map((o) => mkDay({ date: dayAt(o) }));
    const rows = [mkRow({ challenge_id: 'saisie-3', started_at: dayAt(1) })];
    const { service } = mkService(days, rows);
    const hub = await service.getHub(1);
    expect(hub.active).toMatchObject({
      id: 'saisie-3',
      prog: 2,
      total: 3,
      left: 'Encore 1 jour',
    });
    const item = hub.levels[0].items.find((i) => i.id === 'saisie-3');
    expect(item?.state).toBe('active');
    expect(item?.prog).toBe(2);
  });

  it('lazily persists completion when the target is reached', async () => {
    const days = [0, 1, 2].map((o) => mkDay({ date: dayAt(o) }));
    const rows = [mkRow({ challenge_id: 'saisie-3', started_at: dayAt(2) })];
    const { service, prisma } = mkService(days, rows);
    const hub = await service.getHub(1);
    expect(prisma.userChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
    expect(hub.active).toBeNull();
    const item = hub.levels[0].items.find((i) => i.id === 'saisie-3');
    expect(item?.state).toBe('done');
  });

  it('all 16 done: every level done, no current', async () => {
    const rows = [
      'saisie-3',
      'grignotage-3',
      'note-6-3',
      'sport-2-semaine',
      'note-7-5',
      'saisie-7',
      'copieux-5',
      'sport-3-semaine',
      'saisie-14',
      'copieux-10',
      'note-75-10',
      'sport-8-mois',
      'saisie-30',
      'copieux-30',
      'note-8-30',
      'sport-15-mois',
    ].map((id) =>
      mkRow({ challenge_id: id, status: 'completed', completed_at: dayAt(1) }),
    );
    const { service } = mkService([], rows);
    const hub = await service.getHub(1);
    expect(hub.levels.every((l) => l.state === 'done')).toBe(true);
    expect(hub.active).toBeNull();
  });
});

describe('ChallengesService.start', () => {
  it('starts a todo challenge of the current level', async () => {
    const { service, prisma } = mkService([], []);
    const active = await service.start(1, 'saisie-3');
    expect(prisma.userChallenge.create).toHaveBeenCalledWith({
      data: { user_id: 1, challenge_id: 'saisie-3' },
    });
    expect(active.id).toBe('saisie-3');
  });

  it('404 on unknown id', async () => {
    const { service } = mkService([], []);
    await expect(service.start(1, 'nope')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('409 when the challenge is already completed', async () => {
    const rows = [
      mkRow({
        challenge_id: 'saisie-3',
        status: 'completed',
        completed_at: dayAt(1),
      }),
    ];
    const { service } = mkService([], rows);
    await expect(service.start(1, 'saisie-3')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('409 when the level is locked', async () => {
    const { service } = mkService([], []);
    await expect(service.start(1, 'saisie-14')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('409 when another challenge is active', async () => {
    const rows = [mkRow({ challenge_id: 'saisie-3' })];
    const { service } = mkService([], rows);
    await expect(service.start(1, 'grignotage-3')).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('ChallengesService.abandon', () => {
  it('marks the active row abandoned', async () => {
    const row = mkRow({ challenge_id: 'saisie-3' });
    const { service, prisma } = mkService([], [row]);
    const res = await service.abandon(1, 'saisie-3');
    expect(res.ok).toBe(true);
    expect(prisma.userChallenge.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { status: 'abandoned' },
    });
  });

  it('404 when no active row matches', async () => {
    const { service } = mkService([], []);
    await expect(service.abandon(1, 'saisie-3')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('an abandoned challenge can be started again', async () => {
    const rows = [mkRow({ challenge_id: 'saisie-3', status: 'abandoned' })];
    const { service } = mkService([], rows);
    const active = await service.start(1, 'saisie-3');
    expect(active.id).toBe('saisie-3');
  });
});
