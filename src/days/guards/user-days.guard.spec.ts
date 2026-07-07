import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserGuard } from './user-days.guard';

function mkContext(over: {
  userId: number;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: over.userId },
        params: over.params ?? {},
        body: over.body ?? {},
      }),
    }),
  } as never;
}

describe('UserGuard', () => {
  const guard = new UserGuard();

  it('accepts when params.userId matches the JWT', () => {
    expect(
      guard.canActivate(mkContext({ userId: 7, params: { userId: '7' } })),
    ).toBe(true);
  });

  it('rejects when params.userId belongs to another user', () => {
    expect(() =>
      guard.canActivate(mkContext({ userId: 7, params: { userId: '8' } })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects when body.user_id belongs to another user', () => {
    expect(() =>
      guard.canActivate(mkContext({ userId: 7, body: { user_id: 8 } })),
    ).toThrow(UnauthorizedException);
  });

  // Limite connue et assumée : sans userId dans le path ni user_id dans le
  // body (routes /days/:id), le guard laisse passer — l'ownership est alors
  // vérifié dans DaysService.update (cf. days.service.spec).
  it('passes through id-only routes (ownership checked in the service)', () => {
    expect(
      guard.canActivate(mkContext({ userId: 7, params: { id: '123' } })),
    ).toBe(true);
  });
});
