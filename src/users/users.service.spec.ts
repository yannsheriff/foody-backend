import { UsersService } from './users.service';

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

function mkService(): { service: UsersService; prisma: PrismaMock } {
  const prisma: PrismaMock = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        email: 'a@b.c',
        name: 'A',
        password: 'hashed-old',
      }),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: 1,
        email: 'a@b.c',
        name: 'A',
        password: 'hashed-old',
        ...data,
      })),
    },
  };
  return { service: new UsersService(prisma as never), prisma };
}

describe('UsersService.update', () => {
  it('does not touch the password when none is provided', async () => {
    const { service, prisma } = mkService();
    await service.update(1, { name: 'Nouveau nom' });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect('password' in data).toBe(false);
    expect(data.name).toBe('Nouveau nom');
  });

  it('hashes the password when provided', async () => {
    const { service, prisma } = mkService();
    await service.update(1, { password: 'nouveau-secret' });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.password).toBeDefined();
    expect(data.password).not.toBe('nouveau-secret');
  });

  it('never returns the password field', async () => {
    const { service } = mkService();
    const result = await service.update(1, { name: 'X' });
    expect('password' in result).toBe(false);
  });
});
