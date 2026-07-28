import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { BondMatchingService } from '../src/bond/bond-matching.service';
import {
  calculateBondCommission,
  calculateBondPlacementAmounts,
} from '../src/bond/bond-pricing.util';

type Side = 'B' | 'S';

interface TestOrder {
  id: number;
  symbol_id: number;
  cd_code: string;
  participant_code: string;
  member_broker: string;
  order_entry: string;
  flag_id: string;
  side: Side;
  price: number;
  order_size: number;
  buy_vol: number;
  sell_vol: number;
  exe_vol: number;
  dirty_price: number;
  acc_intrt: number;
  ytm: number;
  order_type: string;
  order_date: Date;
  status: string;
}

interface QueryCall {
  sql: string;
  parameters: unknown[];
}

class FakeQueryRunner {
  isTransactionActive = false;
  committed = false;
  rolledBack = false;
  released = false;
  readonly calls: QueryCall[] = [];

  constructor(private readonly database: FakeDataSource) {}

  async connect(): Promise<void> {
    if (this.database.failConnect) {
      throw new Error('Injected connection failure');
    }
  }

  async startTransaction(): Promise<void> {
    this.isTransactionActive = true;
  }

  async commitTransaction(): Promise<void> {
    this.committed = true;
    this.isTransactionActive = false;
  }

  async rollbackTransaction(): Promise<void> {
    this.rolledBack = true;
    this.isTransactionActive = false;
  }

  async release(): Promise<void> {
    this.released = true;
    if (this.database.failRelease) {
      throw new Error('Injected release failure');
    }
  }

  async query(sql: string, parameters: unknown[] = []): Promise<any> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    this.calls.push({ sql: normalized, parameters });

    if (
      normalized.includes('from symbol') &&
      normalized.includes('for update')
    ) {
      if (this.database.deadlockSymbolLocks > 0) {
        this.database.deadlockSymbolLocks -= 1;
        const error = new Error('Deadlock') as Error & {
          errno: number;
          code: string;
        };
        error.errno = 1213;
        error.code = 'ER_LOCK_DEADLOCK';
        throw error;
      }
      return [{ symbol_id: this.database.incoming.symbol_id }];
    }

    if (
      normalized.includes('select * from bond_orders') &&
      normalized.includes('where id = ?')
    ) {
      return [this.database.incoming];
    }

    if (normalized.includes('from adm_participants a')) {
      const participantCode = String(parameters[0]);
      return [
        this.database.institutions[participantCode] ?? {
          institution_id: 1,
          gst_register: 'N',
        },
      ];
    }

    if (
      normalized.includes('select * from bond_orders') &&
      normalized.includes('side = ?')
    ) {
      const resting = this.database.restingOrders.shift();
      return resting ? [resting] : [];
    }

    if (
      normalized.includes('select cds_holding_id') &&
      normalized.includes('for update')
    ) {
      return [{ cds_holding_id: 900 }];
    }

    if (
      normalized.includes('from bond_trade_prices') &&
      normalized.includes('for update')
    ) {
      return [];
    }

    if (
      this.database.failOnExecutedInsert &&
      normalized.startsWith('insert into bond_executed_orders')
    ) {
      throw new Error('Injected execution failure');
    }

    return { insertId: 1, affectedRows: 1 };
  }
}

class FakeDataSource {
  readonly runners: FakeQueryRunner[] = [];
  deadlockSymbolLocks = 0;
  failOnExecutedInsert = false;
  failConnect = false;
  failRelease = false;

  constructor(
    readonly incoming: TestOrder,
    readonly restingOrders: TestOrder[],
    readonly institutions: Record<
      string,
      { institution_id: number; gst_register: string }
    >,
  ) {}

  async query(): Promise<
    Array<{
      symbol_id: number;
      side: Side;
      buy_vol: number;
      sell_vol: number;
    }>
  > {
    return [
      {
        symbol_id: this.incoming.symbol_id,
        side: this.incoming.side,
        buy_vol: this.incoming.buy_vol,
        sell_vol: this.incoming.sell_vol,
      },
    ];
  }

  createQueryRunner(): FakeQueryRunner {
    const runner = new FakeQueryRunner(this);
    this.runners.push(runner);
    return runner;
  }
}

function order(
  id: number,
  side: Side,
  volume: number,
  price: number,
  cdCode: string,
  participantCode: string,
): TestOrder {
  return {
    id,
    symbol_id: 118,
    cd_code: cdCode,
    participant_code: participantCode,
    member_broker: participantCode,
    order_entry: `${participantCode}USER`,
    flag_id: `2607281104${String(id).padStart(2, '0')}`,
    side,
    price,
    order_size: volume,
    buy_vol: side === 'B' ? volume : 0,
    sell_vol: side === 'S' ? volume : 0,
    exe_vol: 0,
    dirty_price: price + 7.39,
    acc_intrt: 7.39,
    ytm: 9.81,
    order_type: 'OTC',
    order_date: new Date(`2026-07-28T05:00:${String(id).padStart(2, '0')}Z`),
    status: 'OPEN',
  };
}

function service(database: FakeDataSource): BondMatchingService {
  return new BondMatchingService(database as unknown as DataSource);
}

void test('bond commission matches the PHP interpolation example', () => {
  assert.equal(calculateBondCommission(102000), 106.27);
  assert.equal(calculateBondCommission(100000.1), 105);
  assert.equal(calculateBondCommission(100000000.1), 20000);
  assert.deepEqual(calculateBondPlacementAmounts(1010, 100, 'Y'), {
    tradeValue: 101000,
    commission: 105.63,
    gst: 5.28,
    totalAmount: 101110.91,
  });
});

void test('returns NO_MATCH and preserves the incoming remainder', async () => {
  const database = new FakeDataSource(
    order(1, 'B', 100, 1010, 'BUYER00001', 'BUYER01'),
    [],
    {},
  );

  const result = await service(database).tryMatchOrder(1);

  assert.equal(result.status, 'NO_MATCH');
  assert.equal(result.remaining, 100);
  assert.equal(database.runners[0].committed, true);
});

void test('executes an exact fill and writes PHP-compatible finance flags', async () => {
  const incoming = order(1, 'B', 100, 1010, 'BUYER00001', 'BUYER01');
  const resting = order(2, 'S', 100, 1010, 'SELLER0001', 'SELLER1');
  const database = new FakeDataSource(incoming, [resting], {
    BUYER01: { institution_id: 10, gst_register: 'Y' },
    SELLER1: { institution_id: 20, gst_register: 'N' },
  });

  const result = await service(database).tryMatchOrder(1);
  const financeCalls = database.runners[0].calls.filter((call) =>
    call.sql.startsWith('insert into bbo_finance'),
  );

  assert.equal(result.status, 'MATCHED');
  assert.equal(result.total_traded, 100);
  assert.equal(result.remaining, 0);
  assert.deepEqual(
    financeCalls.map((call) => call.parameters[3]),
    [3, 4, 5, 2, 4],
  );
  assert.deepEqual(
    financeCalls.map((call) => call.parameters[6]),
    [-101739, -105.63, -5.28, 101739, -105.63],
  );
  assert.deepEqual(
    financeCalls.map((call) => call.parameters[1]),
    [
      incoming.order_entry,
      incoming.order_entry,
      incoming.order_entry,
      resting.order_entry,
      resting.order_entry,
    ],
  );
});

void test('supports multiple price-time fills and leaves a partial remainder', async () => {
  const incoming = order(1, 'B', 100, 1020, 'BUYER00001', 'BUYER01');
  const first = order(2, 'S', 40, 1000, 'SELLER0001', 'SELLER1');
  const second = order(3, 'S', 30, 1010, 'SELLER0002', 'SELLER2');
  const database = new FakeDataSource(incoming, [first, second], {});

  const result = await service(database).tryMatchOrder(1);
  const restingSelect = database.runners[0].calls.find(
    (call) =>
      call.sql.includes('select * from bond_orders') &&
      call.sql.includes('side = ?'),
  );

  assert.equal(result.status, 'MATCHED');
  assert.deepEqual(result.fills, [
    {
      volume: 40,
      price: 1000,
      counterparty_cd_code: first.cd_code,
    },
    {
      volume: 30,
      price: 1010,
      counterparty_cd_code: second.cd_code,
    },
  ]);
  assert.equal(result.remaining, 30);
  assert.match(
    restingSelect?.sql ?? '',
    /order by price asc, order_date asc, id asc/,
  );
  assert.match(restingSelect?.sql ?? '', /cd_code != \?/);
});

void test('rolls back matching only and reports FAILED', async () => {
  const database = new FakeDataSource(
    order(1, 'B', 100, 1010, 'BUYER00001', 'BUYER01'),
    [order(2, 'S', 100, 1010, 'SELLER0001', 'SELLER1')],
    {},
  );
  database.failOnExecutedInsert = true;

  const result = await service(database).tryMatchOrder(1);

  assert.equal(result.status, 'FAILED');
  assert.equal(result.remaining, 100);
  assert.equal(database.runners[0].rolledBack, true);
  assert.equal(database.runners[0].committed, false);
});

void test('retries deadlocks with a fresh matching transaction', async () => {
  const database = new FakeDataSource(
    order(1, 'B', 100, 1010, 'BUYER00001', 'BUYER01'),
    [],
    {},
  );
  database.deadlockSymbolLocks = 1;

  const result = await service(database).tryMatchOrder(1);

  assert.equal(result.status, 'NO_MATCH');
  assert.equal(database.runners.length, 2);
  assert.equal(database.runners[0].rolledBack, true);
  assert.equal(database.runners[1].committed, true);
});

void test('connection and release failures never fail the placement response', async () => {
  const connectFailure = new FakeDataSource(
    order(1, 'B', 100, 1010, 'BUYER00001', 'BUYER01'),
    [],
    {},
  );
  connectFailure.failConnect = true;

  const failedResult = await service(connectFailure).tryMatchOrder(1);
  assert.equal(failedResult.status, 'FAILED');
  assert.equal(failedResult.remaining, 100);

  const releaseFailure = new FakeDataSource(
    order(1, 'B', 100, 1010, 'BUYER00001', 'BUYER01'),
    [],
    {},
  );
  releaseFailure.failRelease = true;

  const successfulResult = await service(releaseFailure).tryMatchOrder(1);
  assert.equal(successfulResult.status, 'NO_MATCH');
  assert.equal(successfulResult.remaining, 100);
});
