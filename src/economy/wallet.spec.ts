import { CoinTransaction, FreezeConsumption } from '@prisma/client';
import {
  activeFreezePurchasedAt,
  computeBalance,
  freezeStock,
} from './wallet';

const tx = (over: Partial<CoinTransaction>): CoinTransaction =>
  ({
    id: 1,
    user_id: 1,
    amount: 0,
    reason: 'x',
    ref: 'y',
    created_at: new Date(),
    ...over,
  }) as CoinTransaction;

const consumption = (): FreezeConsumption =>
  ({
    id: 1,
    user_id: 1,
    day: new Date(),
    consumed_at: new Date(),
    seen: false,
  }) as FreezeConsumption;

describe('computeBalance', () => {
  it('sums signed amounts (credits + debits)', () => {
    expect(
      computeBalance([
        tx({ amount: 15 }),
        tx({ amount: 25 }),
        tx({ amount: -70 }),
      ]),
    ).toBe(-30);
  });
  it('is 0 with no transactions', () => {
    expect(computeBalance([])).toBe(0);
  });
});

describe('freezeStock', () => {
  it('= #buy_freeze − #consumptions', () => {
    const txns = [
      tx({ reason: 'buy_freeze' }),
      tx({ reason: 'buy_freeze' }),
      tx({ reason: 'challenge_won' }),
    ];
    expect(freezeStock(txns, [consumption()])).toBe(1);
  });
  it('never goes negative', () => {
    expect(freezeStock([], [consumption()])).toBe(0);
  });
  it('counts a fresh purchase', () => {
    expect(freezeStock([tx({ reason: 'buy_freeze' })], [])).toBe(1);
  });
});

describe('activeFreezePurchasedAt', () => {
  const at = (iso: string) => new Date(iso);
  it('FIFO : la (n+1)ᵉ conso use le (n+1)ᵉ achat', () => {
    const txns = [
      tx({ reason: 'buy_freeze', created_at: at('2026-07-20T10:00:00Z') }),
      tx({ reason: 'challenge_won', created_at: at('2026-07-21T10:00:00Z') }),
      tx({ reason: 'buy_freeze', created_at: at('2026-07-22T10:00:00Z') }),
    ];
    expect(activeFreezePurchasedAt(txns, [])?.toISOString()).toBe(
      '2026-07-20T10:00:00.000Z',
    );
    expect(
      activeFreezePurchasedAt(txns, [consumption()])?.toISOString(),
    ).toBe('2026-07-22T10:00:00.000Z');
  });
  it('null sans gel en réserve', () => {
    expect(activeFreezePurchasedAt([], [])).toBeNull();
    expect(
      activeFreezePurchasedAt(
        [tx({ reason: 'buy_freeze', created_at: at('2026-07-20T10:00:00Z') })],
        [consumption()],
      ),
    ).toBeNull();
  });
});
