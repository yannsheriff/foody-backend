import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// appleLogin — la vérification du jeton est remplacée, on teste la logique
// retrouver / lier / créer.
function mkService(users: Partial<Record<string, jest.Mock>> = {}) {
  const usersService = {
    findByAppleSub: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    linkAppleSub: jest.fn(),
    create: jest.fn(),
    ...users,
  };
  const jwt = { sign: jest.fn().mockReturnValue('jwt-token') };
  const service = new AuthService(usersService as never, jwt as never);
  return { service, usersService };
}

function stubToken(
  service: AuthService,
  payload: { sub: string; email?: string },
) {
  (
    service as unknown as { verifyAppleToken: () => Promise<typeof payload> }
  ).verifyAppleToken = jest.fn().mockResolvedValue(payload);
}

describe('AuthService.appleLogin', () => {
  it('retrouve un compte déjà lié par apple_sub (aucune création)', async () => {
    const existing = {
      id: 7,
      email: 'a@b.c',
      name: 'A',
      password: 'hash',
      apple_sub: 'sub-1',
    };
    const { service, usersService } = mkService({
      findByAppleSub: jest.fn().mockResolvedValue(existing),
    });
    stubToken(service, { sub: 'sub-1', email: 'a@b.c' });
    const res = await service.appleLogin('token');
    expect(res.user.id).toBe(7);
    expect(res.access_token).toBe('jwt-token');
    expect((res.user as Record<string, unknown>).password).toBeUndefined();
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('lie un compte email existant à la même adresse', async () => {
    const byEmail = {
      id: 3,
      email: 'x@y.z',
      name: 'X',
      password: 'hash',
      apple_sub: null,
    };
    const linked = { ...byEmail, apple_sub: 'sub-2' };
    const { service, usersService } = mkService({
      findByEmail: jest.fn().mockResolvedValue(byEmail),
      linkAppleSub: jest.fn().mockResolvedValue(linked),
    });
    stubToken(service, { sub: 'sub-2', email: 'X@Y.Z' }); // casse Apple normalisée
    const res = await service.appleLogin('token');
    expect(usersService.findByEmail).toHaveBeenCalledWith('x@y.z');
    expect(usersService.linkAppleSub).toHaveBeenCalledWith(3, 'sub-2');
    expect(res.user.id).toBe(3);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it("crée le compte à la première connexion (nom Apple ou préfixe d'email)", async () => {
    const created = { id: 9, email: 'new@relay.appleid.com', name: 'Camille' };
    const linked = { ...created, password: 'hash', apple_sub: 'sub-3' };
    const { service, usersService } = mkService({
      create: jest.fn().mockResolvedValue(created),
      linkAppleSub: jest.fn().mockResolvedValue(linked),
    });
    stubToken(service, { sub: 'sub-3', email: 'new@relay.appleid.com' });
    const res = await service.appleLogin('token', 'Camille');
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@relay.appleid.com',
        name: 'Camille',
      }),
    );
    expect(res.user.id).toBe(9);
  });

  it("401 si Apple ne transmet pas d'email pour un compte inconnu", async () => {
    const { service } = mkService();
    stubToken(service, { sub: 'sub-4' });
    await expect(service.appleLogin('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
