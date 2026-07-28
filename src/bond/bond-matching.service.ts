import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import {
  BondMatchFillDto,
  BondMatchResultDto,
} from './dto/bond-match-result.dto';
import {
  calculateBondCommission,
  calculateBondGst,
  roundBondAmount,
} from './bond-pricing.util';

type BondSide = 'B' | 'S';

interface BondOrderRow {
  id: number;
  symbolId: number;
  cdCode: string;
  participantCode: string;
  memberBroker: string;
  orderEntry: string;
  flagId: string;
  side: BondSide;
  price: number;
  orderSize: number;
  buyVol: number;
  sellVol: number;
  executedVolume: number;
  dirtyPrice: number;
  accruedInterest: number;
  ytm: number;
  orderType: string;
  orderDate: Date | string | null;
  status: string;
  institutionId: number;
  gstRegister: string;
}

interface MatchParties {
  buyer: BondOrderRow;
  seller: BondOrderRow;
}

interface DatabaseError {
  errno?: number;
  code?: string;
  message?: string;
  stack?: string;
}

interface OrderMatchContextRow {
  symbol_id: unknown;
  side: unknown;
  buy_vol: unknown;
  sell_vol: unknown;
}

interface OrderMatchContext {
  symbolId: number;
  remaining: number;
}

interface SymbolIdRow {
  symbol_id: unknown;
}

interface InstitutionRow {
  institution_id: unknown;
  gst_register: unknown;
}

interface HoldingIdRow {
  cds_holding_id: unknown;
}

interface TradePriceRow {
  id: unknown;
  symbol_id: unknown;
  exec_price: unknown;
  exec_qty: unknown;
  last_price: unknown;
  last_qty: unknown;
  last_date: unknown;
  created_at: unknown;
}

const ACTIVE_ORDER_STATUSES = ['OPEN', 'PENDING', 'UPDATED'];
const MAX_MATCH_ATTEMPTS = 3;

function dbString(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

function dbNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

@Injectable()
export class BondMatchingService {
  private readonly logger = new Logger(BondMatchingService.name);

  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  /**
   * Best-effort matching, matching legacy behavior:
   * placement/update has already committed. Each matching attempt is atomic,
   * but a failure leaves the pending order and its reservation intact.
   */
  async tryMatchOrder(orderId: number): Promise<BondMatchResultDto> {
    let context: OrderMatchContext | null;
    try {
      context = await this.getOrderMatchContext(orderId);
    } catch (error) {
      return this.matchFailure(orderId, error);
    }

    if (!context) {
      return this.noMatchResult(0);
    }

    for (let attempt = 1; attempt <= MAX_MATCH_ATTEMPTS; attempt += 1) {
      let queryRunner: QueryRunner | null = null;

      try {
        queryRunner = this.cms22DataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        await this.lockSymbol(queryRunner, context.symbolId);
        const result = await this.matchIncomingOrder(queryRunner, orderId);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        if (queryRunner?.isTransactionActive) {
          try {
            await queryRunner.rollbackTransaction();
          } catch (rollbackError) {
            this.logCleanupFailure(orderId, 'rollback', rollbackError);
          }
        }

        if (this.isRetryableLockError(error) && attempt < MAX_MATCH_ATTEMPTS) {
          this.logger.warn(
            `Bond match lock conflict for order ${orderId}; retrying (${attempt}/${MAX_MATCH_ATTEMPTS})`,
          );
          await this.delay(40 * attempt);
          continue;
        }

        return this.matchFailure(orderId, error, context.remaining);
      } finally {
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (releaseError) {
            this.logCleanupFailure(orderId, 'release', releaseError);
          }
        }
      }
    }

    return this.matchFailure(
      orderId,
      new Error('Match retry limit reached'),
      context.remaining,
    );
  }

  private async getOrderMatchContext(
    orderId: number,
  ): Promise<OrderMatchContext | null> {
    const rows = await this.fetchRows<OrderMatchContextRow>(() =>
      this.cms22DataSource.query(
        `
          SELECT symbol_id, side, buy_vol, sell_vol
          FROM bond_orders
          WHERE id = ?
          LIMIT 1
        `,
        [orderId],
      ),
    );
    if (!rows.length) {
      return null;
    }
    const row = rows[0];
    return {
      symbolId: dbNumber(row.symbol_id),
      remaining:
        dbString(row.side).trim().toUpperCase() === 'B'
          ? dbNumber(row.buy_vol)
          : dbNumber(row.sell_vol),
    };
  }

  /**
   * A stable symbol-row lock serializes all matching for one order book.
   * This avoids duplicate fills/price rows without requiring a schema change.
   */
  private async lockSymbol(
    queryRunner: QueryRunner,
    symbolId: number,
  ): Promise<void> {
    const rows = await this.fetchRows<SymbolIdRow>(() =>
      queryRunner.query(
        `
          SELECT symbol_id
          FROM symbol
          WHERE symbol_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [symbolId],
      ),
    );
    if (!rows.length) {
      throw new Error(`Symbol ${symbolId} not found`);
    }
  }

  private async matchIncomingOrder(
    queryRunner: QueryRunner,
    orderId: number,
  ): Promise<BondMatchResultDto> {
    const incoming = await this.loadLockedOrder(queryRunner, orderId);
    if (!incoming) {
      return this.noMatchResult(0);
    }

    if (
      incoming.orderType !== 'OTC' ||
      !ACTIVE_ORDER_STATUSES.includes(incoming.status)
    ) {
      return this.noMatchResult(this.remainingVolume(incoming));
    }

    let remaining = this.remainingVolume(incoming);
    const fills: BondMatchFillDto[] = [];

    while (remaining > 0) {
      const resting = await this.findAndLockBestRestingOrder(
        queryRunner,
        incoming,
      );
      if (!resting) {
        break;
      }

      const restingRemaining = this.remainingVolume(resting);
      if (restingRemaining <= 0) {
        break;
      }

      const fillVolume = Math.min(remaining, restingRemaining);
      await this.processFill(queryRunner, incoming, resting, fillVolume);

      fills.push({
        volume: fillVolume,
        price: resting.price,
        counterparty_cd_code: resting.cdCode,
      });
      remaining -= fillVolume;
      this.applyFillToLocalOrder(incoming, fillVolume, resting.price);
    }

    if (fills.length === 0) {
      return this.noMatchResult(remaining);
    }

    return {
      status: 'MATCHED',
      traded: true,
      fills,
      total_traded: fills.reduce((sum, fill) => sum + fill.volume, 0),
      remaining,
    };
  }

  private async loadLockedOrder(
    queryRunner: QueryRunner,
    orderId: number,
  ): Promise<BondOrderRow | null> {
    const rows = await this.fetchRows<Record<string, unknown>>(() =>
      queryRunner.query(
        `
          SELECT *
          FROM bond_orders
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [orderId],
      ),
    );

    return rows.length ? this.mapOrderRow(queryRunner, rows[0]) : null;
  }

  private async findAndLockBestRestingOrder(
    queryRunner: QueryRunner,
    incoming: BondOrderRow,
  ): Promise<BondOrderRow | null> {
    const opposite: BondSide = incoming.side === 'B' ? 'S' : 'B';
    const volumeColumn = incoming.side === 'B' ? 'sell_vol' : 'buy_vol';
    const priceOperator = incoming.side === 'B' ? '<=' : '>=';
    const priceDirection = incoming.side === 'B' ? 'ASC' : 'DESC';

    const rows = await this.fetchRows<Record<string, unknown>>(() =>
      queryRunner.query(
        `
          SELECT *
          FROM bond_orders
          WHERE symbol_id = ?
            AND side = ?
            AND price ${priceOperator} ?
            AND ${volumeColumn} > 0
            AND cd_code != ?
            AND id != ?
            AND order_type = 'OTC'
            AND status IN ('OPEN', 'PENDING', 'UPDATED')
          ORDER BY price ${priceDirection}, order_date ASC, id ASC
          LIMIT 1
          FOR UPDATE
        `,
        [
          incoming.symbolId,
          opposite,
          incoming.price,
          incoming.cdCode,
          incoming.id,
        ],
      ),
    );

    return rows.length ? this.mapOrderRow(queryRunner, rows[0]) : null;
  }

  private async mapOrderRow(
    queryRunner: QueryRunner,
    row: Record<string, unknown>,
  ): Promise<BondOrderRow> {
    const participantCode = dbString(row.participant_code).trim();
    const institutionRows = await this.fetchRows<InstitutionRow>(() =>
      queryRunner.query(
        `
          SELECT a.institution_id, COALESCE(i.gst_register, 'N') AS gst_register
          FROM adm_participants a
          LEFT JOIN adm_institution i
            ON a.institution_id = i.institution_id
          WHERE a.participant_code = ?
          LIMIT 1
        `,
        [participantCode],
      ),
    );

    const institutionId = dbNumber(institutionRows[0]?.institution_id);
    if (!institutionId) {
      throw new Error(
        `Institution not found for participant ${participantCode}`,
      );
    }

    return {
      id: dbNumber(row.id),
      symbolId: dbNumber(row.symbol_id),
      cdCode: dbString(row.cd_code).trim(),
      participantCode,
      memberBroker: dbString(row.member_broker).trim(),
      orderEntry: dbString(row.order_entry).trim(),
      flagId: dbString(row.flag_id).trim(),
      side: dbString(row.side).trim().toUpperCase() as BondSide,
      price: dbNumber(row.price),
      orderSize: dbNumber(row.order_size),
      buyVol: dbNumber(row.buy_vol),
      sellVol: dbNumber(row.sell_vol),
      executedVolume: dbNumber(row.exe_vol),
      dirtyPrice: dbNumber(row.dirty_price),
      accruedInterest: dbNumber(row.acc_intrt),
      ytm: dbNumber(row.ytm),
      orderType: dbString(row.order_type).trim().toUpperCase(),
      orderDate: (row.order_date as Date | string | null) ?? null,
      status: dbString(row.status).trim().toUpperCase(),
      institutionId,
      gstRegister: dbString(institutionRows[0]?.gst_register ?? 'N')
        .trim()
        .toUpperCase(),
    };
  }

  private async processFill(
    queryRunner: QueryRunner,
    incoming: BondOrderRow,
    resting: BondOrderRow,
    fillVolume: number,
  ): Promise<void> {
    const tradePrice = resting.price;
    const tradeAmount = roundBondAmount(resting.dirtyPrice * fillVolume);
    const commission = calculateBondCommission(tradePrice * fillVolume);
    const parties = this.resolveParties(incoming, resting);
    const buyerGst = calculateBondGst(commission, parties.buyer.gstRegister);
    const sellerGst = calculateBondGst(commission, parties.seller.gstRegister);

    const incomingAfter = this.remainingVolume(incoming) - fillVolume;
    const restingAfter = this.remainingVolume(resting) - fillVolume;

    await this.insertExecutedOrders(
      queryRunner,
      incoming,
      resting,
      fillVolume,
      tradePrice,
    );
    await this.updateOrderAfterFill(
      queryRunner,
      resting,
      restingAfter,
      fillVolume,
      tradePrice,
    );
    await this.updateOrderAfterFill(
      queryRunner,
      incoming,
      incomingAfter,
      fillVolume,
      tradePrice,
    );
    await this.auditOrder(queryRunner, incoming.id);
    await this.auditOrder(queryRunner, resting.id);
    await this.creditBuyerPendingIn(
      queryRunner,
      parties.buyer.cdCode,
      incoming.symbolId,
      fillVolume,
    );
    await this.writeExecutionLedger(
      queryRunner,
      parties,
      incoming.symbolId,
      fillVolume,
      tradePrice,
      tradeAmount,
      commission,
      buyerGst,
      sellerGst,
    );

    if (incomingAfter === 0) {
      await this.removeFilledOrder(queryRunner, incoming);
    }
    if (restingAfter === 0) {
      await this.removeFilledOrder(queryRunner, resting);
    }

    await this.updateTradePrice(
      queryRunner,
      incoming.symbolId,
      tradePrice,
      fillVolume,
    );
  }

  private async insertExecutedOrders(
    queryRunner: QueryRunner,
    incoming: BondOrderRow,
    resting: BondOrderRow,
    fillVolume: number,
    tradePrice: number,
  ): Promise<void> {
    const query = `
      INSERT INTO bond_executed_orders (
        cd_code, participant_code, sub_user, member_broker, order_date,
        symbol_id, order_exe_price, lot_size_execute, status, side,
        lot_check, flag_id, dirty_price, accur_rate, ytm, order_type
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const order of [incoming, resting]) {
      await queryRunner.query(query, [
        order.cdCode,
        order.participantCode,
        order.orderEntry,
        order.orderEntry,
        order.symbolId,
        tradePrice,
        fillVolume,
        order.side,
        fillVolume,
        order.flagId,
        resting.dirtyPrice,
        resting.accruedInterest,
        resting.ytm,
        resting.orderType,
      ]);
    }
  }

  private async updateOrderAfterFill(
    queryRunner: QueryRunner,
    order: BondOrderRow,
    remaining: number,
    fillVolume: number,
    tradePrice: number,
  ): Promise<void> {
    const volumeColumn = order.side === 'B' ? 'buy_vol' : 'sell_vol';
    const status = remaining === 0 ? 'EXECUTED' : 'PENDING';

    await queryRunner.query(
      `
        UPDATE bond_orders
        SET order_size = ?,
            ${volumeColumn} = ?,
            exe_vol = COALESCE(exe_vol, 0) + ?,
            exe_price = ?,
            status = ?
        WHERE id = ?
      `,
      [remaining, remaining, fillVolume, tradePrice, status, order.id],
    );
  }

  private async auditOrder(
    queryRunner: QueryRunner,
    orderId: number,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO bond_order_audits (
          bond_order_id, symbol_id, cd_code, participant_code, member_broker,
          order_size, order_entry, buy_vol, sell_vol, flag_id, side, price,
          exe_vol, exe_price, lot_check, acc_intrt, dirty_price, ytm,
          order_type, quoted_to, order_date, status
        )
        SELECT
          id, symbol_id, cd_code, participant_code, member_broker,
          order_size, order_entry, buy_vol, sell_vol, flag_id, side, price,
          exe_vol, exe_price, lot_check, acc_intrt, dirty_price, ytm,
          order_type, quoted_to, order_date, status
        FROM bond_orders
        WHERE id = ?
      `,
      [orderId],
    );
  }

  private async creditBuyerPendingIn(
    queryRunner: QueryRunner,
    buyerCdCode: string,
    symbolId: number,
    fillVolume: number,
  ): Promise<void> {
    const rows = await this.fetchRows<HoldingIdRow>(() =>
      queryRunner.query(
        `
          SELECT cds_holding_id
          FROM cds_holding
          WHERE cd_code = ? AND symbol_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [buyerCdCode, symbolId],
      ),
    );

    if (rows.length) {
      await queryRunner.query(
        `
          UPDATE cds_holding
          SET pending_in_vol = pending_in_vol + ?
          WHERE cds_holding_id = ?
        `,
        [fillVolume, rows[0].cds_holding_id],
      );
      return;
    }

    await queryRunner.query(
      `
        INSERT INTO cds_holding (cd_code, symbol_id, pending_in_vol)
        VALUES (?, ?, ?)
      `,
      [buyerCdCode, symbolId, fillVolume],
    );
  }

  private async writeExecutionLedger(
    queryRunner: QueryRunner,
    parties: MatchParties,
    symbolId: number,
    fillVolume: number,
    tradePrice: number,
    tradeAmount: number,
    commission: number,
    buyerGst: number,
    sellerGst: number,
  ): Promise<void> {
    await this.insertFinanceRow(
      queryRunner,
      parties.buyer,
      `Bond purchase - ${fillVolume} units of ${symbolId} at Nu. ${tradePrice}`,
      3,
      -tradeAmount,
      symbolId,
    );
    await this.insertFinanceRow(
      queryRunner,
      parties.buyer,
      `Commission - ${fillVolume} units of ${symbolId} at Nu. ${tradePrice}`,
      4,
      -commission,
      symbolId,
    );
    if (buyerGst > 0) {
      await this.insertFinanceRow(
        queryRunner,
        parties.buyer,
        `GST - ${fillVolume} units of ${symbolId} at Nu. ${tradePrice}`,
        5,
        -buyerGst,
        symbolId,
      );
    }

    await this.insertFinanceRow(
      queryRunner,
      parties.seller,
      `Bond sale - ${fillVolume} units of ${symbolId} at Nu. ${tradePrice}`,
      2,
      tradeAmount,
      symbolId,
    );
    await this.insertFinanceRow(
      queryRunner,
      parties.seller,
      `Commission - ${fillVolume} units of ${symbolId} at Nu. ${tradePrice}`,
      4,
      -commission,
      symbolId,
    );
    if (sellerGst > 0) {
      await this.insertFinanceRow(
        queryRunner,
        parties.seller,
        `GST - ${fillVolume} units of ${symbolId} at Nu. ${tradePrice}`,
        5,
        -sellerGst,
        symbolId,
      );
    }
  }

  private async insertFinanceRow(
    queryRunner: QueryRunner,
    order: BondOrderRow,
    remarks: string,
    flag: number,
    amount: number,
    symbolId: number,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO bbo_finance (
          cd_code, user_name, remarks, flag, institution_id,
          flag_id, amount, symbol_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        order.cdCode,
        order.orderEntry,
        remarks,
        flag,
        order.institutionId,
        order.flagId,
        roundBondAmount(amount),
        symbolId,
      ],
    );
  }

  private async removeFilledOrder(
    queryRunner: QueryRunner,
    order: BondOrderRow,
  ): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM bond_orders
        WHERE id = ? AND symbol_id = ? AND cd_code = ?
      `,
      [order.id, order.symbolId, order.cdCode],
    );
    await queryRunner.query(
      `
        DELETE FROM bbo_finance
        WHERE flag_id = ? AND flag = 0 AND cd_code = ? AND symbol_id = ?
      `,
      [order.flagId, order.cdCode, order.symbolId],
    );
  }

  private async updateTradePrice(
    queryRunner: QueryRunner,
    symbolId: number,
    tradePrice: number,
    fillVolume: number,
  ): Promise<void> {
    const rows = await this.fetchRows<TradePriceRow>(() =>
      queryRunner.query(
        `
          SELECT id, symbol_id, exec_price, exec_qty, last_price,
                 last_qty, last_date, created_at
          FROM bond_trade_prices
          WHERE symbol_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [symbolId],
      ),
    );

    if (!rows.length) {
      await queryRunner.query(
        `
          INSERT INTO bond_trade_prices (
            symbol_id, exec_price, exec_qty, created_at
          ) VALUES (?, ?, ?, NOW())
        `,
        [symbolId, tradePrice, fillVolume],
      );
      return;
    }

    const priceRow = rows[0];
    await queryRunner.query(
      `
        INSERT INTO bond_price_histories (
          symbol_id, exec_price, exec_qty, last_price,
          last_qty, last_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        priceRow.symbol_id,
        priceRow.exec_price,
        priceRow.exec_qty,
        priceRow.last_price,
        priceRow.last_qty,
        priceRow.last_date,
        priceRow.created_at,
      ],
    );
    await queryRunner.query(
      `
        UPDATE bond_trade_prices
        SET last_price = exec_price,
            last_qty = exec_qty,
            last_date = created_at,
            exec_price = ?,
            exec_qty = ?,
            created_at = NOW()
        WHERE id = ?
      `,
      [tradePrice, fillVolume, priceRow.id],
    );
  }

  private resolveParties(
    incoming: BondOrderRow,
    resting: BondOrderRow,
  ): MatchParties {
    return incoming.side === 'B'
      ? { buyer: incoming, seller: resting }
      : { buyer: resting, seller: incoming };
  }

  private remainingVolume(order: BondOrderRow): number {
    return order.side === 'B' ? order.buyVol : order.sellVol;
  }

  private applyFillToLocalOrder(
    order: BondOrderRow,
    fillVolume: number,
    tradePrice: number,
  ): void {
    order.orderSize -= fillVolume;
    order.executedVolume += fillVolume;
    order.status = order.orderSize === 0 ? 'EXECUTED' : 'PENDING';
    if (order.side === 'B') {
      order.buyVol -= fillVolume;
    } else {
      order.sellVol -= fillVolume;
    }
    order.price = order.price || tradePrice;
  }

  private noMatchResult(remaining: number): BondMatchResultDto {
    return {
      status: 'NO_MATCH',
      traded: false,
      fills: [],
      total_traded: 0,
      remaining,
    };
  }

  private matchFailure(
    orderId: number,
    error: unknown,
    remaining = 0,
  ): BondMatchResultDto {
    const dbError = error as DatabaseError;
    this.logger.error(
      `Bond matching failed for order ${orderId}: ${dbError.message ?? 'Unknown error'}`,
      dbError.stack,
    );
    return {
      status: 'FAILED',
      traded: false,
      fills: [],
      total_traded: 0,
      remaining,
      message: 'Order remains pending because matching could not be completed.',
    };
  }

  private logCleanupFailure(
    orderId: number,
    operation: 'rollback' | 'release',
    error: unknown,
  ): void {
    const dbError = error as DatabaseError;
    this.logger.error(
      `Bond match ${operation} failed for order ${orderId}: ${dbError.message ?? 'Unknown error'}`,
      dbError.stack,
    );
  }

  private async fetchRows<T>(operation: () => Promise<unknown>): Promise<T[]> {
    const result = await operation();
    if (!Array.isArray(result)) {
      throw new Error('Expected database query to return rows');
    }
    return result as T[];
  }

  private isRetryableLockError(error: unknown): boolean {
    const dbError = error as DatabaseError;
    return (
      dbError.errno === 1213 ||
      dbError.errno === 1205 ||
      dbError.code === 'ER_LOCK_DEADLOCK' ||
      dbError.code === 'ER_LOCK_WAIT_TIMEOUT'
    );
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
