import { Days } from '@prisma/client';
import { DaysService } from './days.service';

let nextId = 1;
function mkRow(over: Partial<Days> = {}): Days {
  return {
    id: nextId++,
    user_id: 1,
    morning_score: null,
    afternoon_score: null,
    evening_score: null,
    snack: null,
    sport: false,
    sport_type: null,
    date: new Date(),
    meals_completed_at: null,
    ...over,
  } as Days;
}

interface PrismaMock {
  days: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
}

function mkService(): { service: DaysService; prisma: PrismaMock } {
  const prisma: PrismaMock = {
    days: {
      create: jest.fn().mockImplementation(({ data }) => mkRow(data)),
      update: jest.fn().mockImplementation(({ data }) => mkRow(data)),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return { service: new DaysService(prisma as never), prisma };
}

describe('DaysService.createDay', () => {
  it('stamps meals_completed_at when the 3 meals arrive at creation', async () => {
    const { service, prisma } = mkService();
    await service.createDay({
      user_id: 1,
      morning_score: 'tres-leger',
      afternoon_score: 'normal',
      evening_score: 'leger',
    } as never);
    const data = prisma.days.create.mock.calls[0][0].data;
    expect(data.meals_completed_at).toBeInstanceOf(Date);
  });

  it('does not stamp an incomplete creation', async () => {
    const { service, prisma } = mkService();
    await service.createDay({
      user_id: 1,
      morning_score: 'leger',
    } as never);
    const data = prisma.days.create.mock.calls[0][0].data;
    expect('meals_completed_at' in data).toBe(false);
  });
});

describe('DaysService.update', () => {
  it('stamps when the third meal completes the day', async () => {
    const { service, prisma } = mkService();
    prisma.days.findUnique.mockResolvedValue(
      mkRow({ morning_score: 'leger', afternoon_score: 'normal' }),
    );
    await service.update(1, { evening_score: 'copieux' } as never);
    const data = prisma.days.update.mock.calls[0][0].data;
    expect(data.meals_completed_at).toBeInstanceOf(Date);
  });

  it('is sticky: never restamps an already-stamped day', async () => {
    const { service, prisma } = mkService();
    prisma.days.findUnique.mockResolvedValue(
      mkRow({
        morning_score: 'leger',
        afternoon_score: 'normal',
        evening_score: 'leger',
        meals_completed_at: new Date('2026-06-01T12:00:00Z'),
      }),
    );
    await service.update(1, { morning_score: 'tres-copieux' } as never);
    const data = prisma.days.update.mock.calls[0][0].data;
    expect('meals_completed_at' in data).toBe(false);
  });

  it('does not clear the stamp when a meal is nulled', async () => {
    const { service, prisma } = mkService();
    prisma.days.findUnique.mockResolvedValue(
      mkRow({
        morning_score: 'leger',
        afternoon_score: 'normal',
        evening_score: 'leger',
        meals_completed_at: new Date('2026-06-01T12:00:00Z'),
      }),
    );
    await service.update(1, { evening_score: null } as never);
    const data = prisma.days.update.mock.calls[0][0].data;
    expect('meals_completed_at' in data).toBe(false);
    expect(data.evening_score).toBeNull();
  });

  it('does not stamp a still-incomplete update', async () => {
    const { service, prisma } = mkService();
    prisma.days.findUnique.mockResolvedValue(mkRow({ morning_score: 'leger' }));
    await service.update(1, { afternoon_score: 'normal' } as never);
    const data = prisma.days.update.mock.calls[0][0].data;
    expect('meals_completed_at' in data).toBe(false);
  });
});

describe('DaysService.createDay (idempotent par jour)', () => {
  it('merges into the existing row of the same UTC day instead of duplicating', async () => {
    const { service, prisma } = mkService();
    const existing = mkRow({ id: 105, date: new Date('2026-07-06T00:00:00Z') });
    prisma.days.findFirst.mockResolvedValue(existing);
    prisma.days.findUnique.mockResolvedValue(existing);
    await service.createDay({
      user_id: 1,
      date: new Date('2026-07-06T12:00:00Z'),
      morning_score: 'leger',
    } as never);
    expect(prisma.days.create).not.toHaveBeenCalled();
    expect(prisma.days.update.mock.calls[0][0].where).toEqual({ id: 105 });
  });

  it('recovers from a P2002 race by merging into the winner', async () => {
    const { service, prisma } = mkService();
    const winner = mkRow({ id: 7 });
    prisma.days.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.days.create.mockRejectedValue({ code: 'P2002' });
    prisma.days.findUnique.mockResolvedValue(winner);
    await service.createDay({ user_id: 1, morning_score: 'leger' } as never);
    expect(prisma.days.update.mock.calls[0][0].where).toEqual({ id: 7 });
  });
});

describe('DaysService.getOrCreateTodayForUser', () => {
  it('creates the empty day without a stamp', async () => {
    const { service, prisma } = mkService();
    prisma.days.findFirst.mockResolvedValue(null);
    await service.getOrCreateTodayForUser(1);
    const data = prisma.days.create.mock.calls[0][0].data;
    expect('meals_completed_at' in data).toBe(false);
  });
});
