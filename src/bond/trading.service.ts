import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { CdsHolding } from '../entities/cds-holding.entity';
import { SecurityTypeMaster } from '../entities/security-type-master.entity';
import { SecurityTypeResponseDto } from './dto/security-type-response.dto';
import { Symbol } from '../entities/symbol.entity';
import { BondVolResponseDto } from './dto/bond-vol.dto';
import { SymbolResponseDto } from './dto/symbol-response.dto';
import { BondDetailsResponseDto } from './dto/bond-details-response.dto';
import { BondBuyOrderDto, BondBuyResponseDto } from './dto/bond-buy.dto';
import { BondSellOrderDto } from './dto/bond-sell.dto';
import { BondYtmRequestDto, BondYtmResponseDto } from './dto/bond-ytm.dto';
import {
  BondPendingOrderItemDto,
  BondPendingOrdersResponseDto,
} from './dto/bond-pending-order.dto';
import {
  BondExecutedHistoryItemDto,
  BondExecutedHistoryResponseDto,
} from './dto/bond-history.dto';
import {
  BondOrderbookResponseDto,
} from './dto/bond-orderbook.dto';
import {
  BondUpdateOrderRequestDto,
  BondUpdateOrderResponseDto,
} from './dto/bond-update-order.dto';
import {
  BondCancelOrderRequestDto,
  BondCancelOrderResponseDto,
} from './dto/bond-cancel-order.dto';

@Injectable()
export class BondTradingService {
  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
    @InjectRepository(SecurityTypeMaster)
    private readonly securityTypeMasterRepository: Repository<SecurityTypeMaster>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(CdsHolding)
    private readonly cdsHoldingRepository: Repository<CdsHolding>,
  ) {}

  async getSecurityTypes(): Promise<SecurityTypeResponseDto[]> {
    const query = `
      SELECT s.id, s.security_type, s.precise_name
      FROM security_type_masters s
      WHERE s.status = 1 AND s.precise_name != 'OS'
    `;

    const rows = await this.securityTypeMasterRepository.query(query);

    return rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      security_type: String(row.security_type),
      precise_name: String(row.precise_name),
    }));
  }

  async getSymbols(securityType: string): Promise<SymbolResponseDto[]> {
    const query = `
      SELECT symbol, symbol_id, name
      FROM symbol
      WHERE status = 1 AND trsstatus = 1 AND security_type = ?
    `;

    const rows = await this.symbolRepository.query(query, [securityType]);

    return rows.map((row: Record<string, unknown>) => ({
      symbol: String(row.symbol),
      symbol_id: Number(row.symbol_id),
      name: String(row.name),
    }));
  }

  async getBondDetails(symbolId: number): Promise<BondDetailsResponseDto | null> {
    const query = `
      SELECT s.maturity_date, s.face_value, s.coupon_rates
      FROM symbol s
      WHERE s.symbol_id = ?
    `;

    const rows = await this.symbolRepository.query(query, [symbolId]);
    if (!rows.length) {
      return null;
    }

    const row = rows[0] as Record<string, unknown>;

    return {
      maturity_date: row.maturity_date ? String(row.maturity_date) : null,
      face_value: row.face_value == null ? null : Number(row.face_value),
      coupon_rates: row.coupon_rates == null ? null : Number(row.coupon_rates),
    };
  }

  async getHoldingVolume(
    symbolId: number,
    cdCode: string,
  ): Promise<BondVolResponseDto> {
    const query = `
      SELECT c.volume
      FROM cds_holding c
      WHERE c.symbol_id = ? AND c.cd_code = ?
    `;

    const rows = await this.cdsHoldingRepository.query(query, [symbolId, cdCode]);
    const rawVolume = rows.length ? rows[0].volume : 0;

    return {
      volume: rawVolume == null ? 0 : Number(rawVolume),
    };
  }

  async calculateYtm(dto: BondYtmRequestDto): Promise<BondYtmResponseDto> {
    const settlementDate = this.startOfDay(new Date());
    const cleanPrice = Number(dto.clean_price);
    const quantity = Number(dto.quantity ?? 1);

    const bondRow = await this.getBondPricingRow(dto.symbol_id);
    const maturityDate = this.parseDateOrThrow(
      bondRow.maturity_date,
      'Invalid maturity_date in symbol table',
    );
    const dateOfIssue = this.parseDateOrThrow(
      bondRow.date_of_issue,
      'Invalid date_of_issue in symbol table',
    );

    if (maturityDate <= settlementDate) {
      throw new BadRequestException('Bond is matured; YTM cannot be calculated');
    }

    const faceValue = Number(bondRow.face_value ?? 0);
    const couponRate = Number(bondRow.coupon_rates ?? 0);
    const frequency = this.normalizeFrequency(bondRow.frequency);
    const lastCouponDate = await this.resolveLastCouponDate(dto.symbol_id, dateOfIssue);
    const nextCouponDate = this.addMonths(lastCouponDate, 12 / frequency);
    const accruedInterest = this.calculateAccruedInterest({
      faceValue,
      couponRate,
      frequency,
      settlementDate,
      lastCouponDate,
      nextCouponDate,
    });
    const dirtyPrice = cleanPrice + accruedInterest;
    const ytm = this.solveYtmByBinarySearch({
      dirtyPrice,
      faceValue,
      couponRate,
      frequency,
      settlementDate,
      maturityDate,
      nextCouponDate,
    });

    const commissionRate = await this.calculateCommissionRate(dto.cd_code);
    const tradeValue = cleanPrice * quantity;
    const commissionAmount = this.calculateCommission(tradeValue);

    return {
      clean_price: this.roundTo(cleanPrice, 4),
      accrued_interest: this.roundTo(accruedInterest, 4),
      dirty_price: this.roundTo(dirtyPrice, 4),
      ytm: this.roundTo(ytm * 100, 4),
      commission_rate: this.roundTo(commissionRate, 4),
      commission_amount: this.roundTo(commissionAmount, 4),
      settlement_date: this.formatDate(settlementDate),
      last_coupon_date: this.formatDate(lastCouponDate),
      next_coupon_date: this.formatDate(nextCouponDate),
      maturity_date: this.formatDate(maturityDate),
      frequency,
    };
  }

  private async getBondPricingRow(symbolId: number): Promise<Record<string, unknown>> {
    const query = `
      SELECT s.maturity_date, s.face_value, s.coupon_rates, s.date_of_issue, s.coupon_payable AS frequency
      FROM symbol s
      WHERE s.symbol_id = ?
      LIMIT 1
    `;
    const rows = await this.cms22DataSource.query(query, [symbolId]);
    if (!rows.length) {
      throw new NotFoundException('Bond symbol not found');
    }
    return rows[0] as Record<string, unknown>;
  }

  private async resolveLastCouponDate(
    symbolId: number,
    fallbackDate: Date,
  ): Promise<Date> {
    const query = `
      SELECT c.date
      FROM coupon_payable_date c
      WHERE c.symbol_id = ? AND c.status = 1
      ORDER BY c.id DESC
      LIMIT 1
    `;
    const rows = await this.cms22DataSource.query(query, [symbolId]);
    if (!rows.length || !rows[0].date) {
      const issueMinusOne = new Date(fallbackDate);
      issueMinusOne.setDate(issueMinusOne.getDate() - 1);
      return this.startOfDay(issueMinusOne);
    }
    return this.parseDateOrThrow(rows[0].date, 'Invalid coupon payable date');
  }

  private async calculateCommissionRate(cdCode: string): Promise<number> {
    const clientQuery = `
      SELECT institution_id
      FROM client_account
      WHERE cd_code = ?
      LIMIT 1
    `;
    const clientRows = await this.cms22DataSource.query(clientQuery, [cdCode]);
    if (!clientRows.length || !clientRows[0].institution_id) {
      return 0.5;
    }

    const commissionQuery = `
      SELECT rate
      FROM bbo_commission
      WHERE institution_id = ?
      LIMIT 1
    `;
    const commissionRows = await this.cms22DataSource.query(commissionQuery, [
      clientRows[0].institution_id,
    ]);
    if (!commissionRows.length || commissionRows[0].rate == null) {
      return 0.5;
    }

    return Number(commissionRows[0].rate);
  }

  private calculateAccruedInterest(input: {
    faceValue: number;
    couponRate: number;
    frequency: number;
    settlementDate: Date;
    lastCouponDate: Date;
    nextCouponDate: Date;
  }): number {
    const periodCoupon = (input.faceValue * (input.couponRate / 100)) / input.frequency;
    const daysElapsed = this.daysBetween(input.lastCouponDate, input.settlementDate);
    const daysInPeriod = Math.max(1, this.daysBetween(input.lastCouponDate, input.nextCouponDate));
    return periodCoupon * (daysElapsed / daysInPeriod);
  }

  private solveYtmByBinarySearch(input: {
    dirtyPrice: number;
    faceValue: number;
    couponRate: number;
    frequency: number;
    settlementDate: Date;
    maturityDate: Date;
    nextCouponDate: Date;
  }): number {
    let low = 0.0001;
    let high = 1;
    const maxIterations = 40;

    for (let i = 0; i < maxIterations; i += 1) {
      const mid = (low + high) / 2;
      const modeledPrice = this.priceFromYield({
        annualYieldDecimal: mid,
        faceValue: input.faceValue,
        couponRate: input.couponRate,
        frequency: input.frequency,
        settlementDate: input.settlementDate,
        maturityDate: input.maturityDate,
        nextCouponDate: input.nextCouponDate,
      });

      if (modeledPrice > input.dirtyPrice) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  private priceFromYield(input: {
    annualYieldDecimal: number;
    faceValue: number;
    couponRate: number;
    frequency: number;
    settlementDate: Date;
    maturityDate: Date;
    nextCouponDate: Date;
  }): number {
    const coupon = (input.faceValue * (input.couponRate / 100)) / input.frequency;
    const periodMonths = 12 / input.frequency;
    const periodRate = input.annualYieldDecimal / input.frequency;

    let pv = 0;
    let couponDate = new Date(input.nextCouponDate);
    let safety = 0;

    while (couponDate <= input.maturityDate && safety < 1000) {
      safety += 1;
      const years = this.daysBetween(input.settlementDate, couponDate) / 365;
      const exponent = years * input.frequency;
      const discount = Math.pow(1 + periodRate, exponent);

      pv += coupon / discount;
      if (this.isSameDay(couponDate, input.maturityDate)) {
        pv += input.faceValue / discount;
      }

      couponDate = this.addMonths(couponDate, periodMonths);
      if (couponDate > input.maturityDate && !this.isSameDay(couponDate, input.maturityDate)) {
        break;
      }
    }

    return pv;
  }

  private calculateCommission(tradeValue: number): number {
    if (tradeValue <= 0) {
      return 0;
    }

    if (tradeValue <= 1000) {
      return 10;
    }

    const brackets = [
      { min: 1000, max: 100000, commMin: 10, commMax: 100 },
      { min: 100001, max: 250000, commMin: 105, commMax: 200 },
      { min: 250001, max: 500000, commMin: 210, commMax: 300 },
      { min: 500001, max: 1000000, commMin: 320, commMax: 450 },
      { min: 1000001, max: 2500000, commMin: 475, commMax: 600 },
      { min: 2500001, max: 5000000, commMin: 650, commMax: 750 },
      { min: 5000001, max: 10000000, commMin: 760, commMax: 1500 },
      { min: 10000001, max: 25000000, commMin: 1550, commMax: 2500 },
      { min: 25000001, max: 50000000, commMin: 2725, commMax: 4500 },
      { min: 50000001, max: 100000000, commMin: 5000, commMax: 10000 },
    ];

    for (const bracket of brackets) {
      if (tradeValue >= bracket.min && tradeValue <= bracket.max) {
        const ratio = (tradeValue - bracket.min) / (bracket.max - bracket.min);
        const commission =
          bracket.commMin + ratio * (bracket.commMax - bracket.commMin);
        return this.roundTo(commission, 2);
      }
    }

    if (tradeValue >= 100000001) {
      return 20000;
    }

    // Fallback should never happen, but keep safe behavior.
    return 0;
  }

  async placeBuyOrder(dto: BondBuyOrderDto): Promise<BondBuyResponseDto> {
    if (
      !dto.cd_code?.trim() ||
      !dto.participant_code?.trim() ||
      !dto.order_entry?.trim() ||
      !dto.symbol_id ||
      !dto.order_size ||
      !dto.price ||
      dto.side !== 'B'
    ) {
      throw new BadRequestException('Invalid order parameters.');
    }
    if (dto.order_size <= 0 || dto.price <= 0) {
      throw new BadRequestException('Invalid order parameters.');
    }
    if (dto.order_size % 10 !== 0) {
      throw new BadRequestException('Volume should be multiple of 10.');
    }
    if (!this.hasAtMostTwoDecimals(dto.price)) {
      throw new BadRequestException('Price should be at most 2 decimal places.');
    }

    const marketOpen = await this.isBondMarketOpen();
    if (!marketOpen) {
      throw new BadRequestException('Market Closed.');
    }

    const accountMeta = await this.getAccountMeta(dto.cd_code);
    if (dto.symbol_id === 118 && ['J', 'R', 'A'].includes(accountMeta.accType)) {
      throw new BadRequestException(
        'Institutions are not allowed to trade GNBB Bond.',
      );
    }

    const sameSideExists = await this.hasPendingSameSideOrder(
      dto.cd_code,
      dto.symbol_id,
      dto.participant_code,
      dto.side,
    );
    if (sameSideExists) {
      throw new BadRequestException(
        'An order already exists. Consider updating it.',
      );
    }

    const anyPendingExists = await this.hasAnyPendingOrder(
      dto.cd_code,
      dto.symbol_id,
      dto.participant_code,
    );
    if (anyPendingExists) {
      throw new BadRequestException(
        'Cannot place both Buy and Sell orders for the same symbol simultaneously.',
      );
    }

    const availableBalance = await this.getAvailableBalance(dto.cd_code);
    const brokerContext = await this.getBrokerInstitutionContext(dto.order_entry);
    const { commission, gst, totalAmount } = this.calculatePlacementAmounts(
      dto.price,
      dto.order_size,
      brokerContext.gstRegister,
    );
    if (totalAmount > availableBalance) {
      throw new BadRequestException(
        `Insufficient cash. Available: ${this.roundTo(availableBalance, 2)}`,
      );
    }

    const institutionId =
      brokerContext.institutionId ??
      (await this.getInstitutionIdByCdCode(dto.cd_code));
    const flagId = this.generateFlagId();
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.insertBondOrderAudit(queryRunner, dto, flagId, commission);

      const insertOrderQuery = `
        INSERT INTO bond_orders(
          cd_code, participant_code, order_entry, order_size, symbol_id,
          price, side, commis_amt, flag_id, member_broker,
          sell_vol, buy_vol, acc_intrt, dirty_price, ytm, order_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(insertOrderQuery, [
        dto.cd_code.trim(),
        dto.participant_code.trim(),
        dto.order_entry.trim(),
        dto.order_size,
        dto.symbol_id,
        dto.price,
        dto.side,
        commission,
        flagId,
        dto.participant_code.trim(),
        0,
        dto.order_size,
        dto.acc_intrt,
        dto.dirty_price,
        dto.ytm,
        dto.order_type.trim(),
      ]);

      const remarks = `Bond Buy Order entry by user ${dto.order_entry.trim()} of member ${dto.participant_code.trim()} volume ${dto.order_size} @ Nu. ${dto.price}`;
      const insertFinanceQuery = `
        INSERT INTO bbo_finance (
          cd_code, user_name, remarks, flag, institution_id, flag_id, status, amount, symbol_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(insertFinanceQuery, [
        dto.cd_code.trim(),
        dto.order_entry.trim(),
        remarks,
        0,
        institutionId,
        flagId,
        0,
        -totalAmount,
        dto.symbol_id,
      ]);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.tryMatchBondTrade();

    return {
      message: 'Buy Order Placed successfully.',
      flag_id: flagId,
      commission: this.roundTo(commission, 2),
      gst: this.roundTo(gst, 2),
      total_amount: this.roundTo(totalAmount, 2),
    };
  }

  async placeSellOrder(dto: BondSellOrderDto): Promise<BondBuyResponseDto> {
    if (
      !dto.cd_code?.trim() ||
      !dto.participant_code?.trim() ||
      !dto.order_entry?.trim() ||
      !dto.symbol_id ||
      !dto.order_size ||
      !dto.price ||
      dto.side !== 'S'
    ) {
      throw new BadRequestException('Invalid order parameters.');
    }
    if (dto.order_size <= 0 || dto.price <= 0) {
      throw new BadRequestException('Invalid order parameters.');
    }
    if (dto.order_size % 10 !== 0) {
      throw new BadRequestException('Volume should be multiple of 10.');
    }
    if (!this.hasAtMostTwoDecimals(dto.price)) {
      throw new BadRequestException('Price should be at most 2 decimal places.');
    }

    const marketOpen = await this.isBondMarketOpen();
    if (!marketOpen) {
      throw new BadRequestException('Market Closed.');
    }

    const accountMeta = await this.getAccountMeta(dto.cd_code);
    if (dto.symbol_id === 118 && ['J', 'R', 'A'].includes(accountMeta.accType)) {
      throw new BadRequestException(
        'Institutions are not allowed to trade GNBB Bond.',
      );
    }

    const sameSideExists = await this.hasPendingSameSideOrder(
      dto.cd_code,
      dto.symbol_id,
      dto.participant_code,
      dto.side,
    );
    if (sameSideExists) {
      throw new BadRequestException(
        'An order already exists. Consider updating it.',
      );
    }

    const anyPendingExists = await this.hasAnyPendingOrder(
      dto.cd_code,
      dto.symbol_id,
      dto.participant_code,
    );
    if (anyPendingExists) {
      throw new BadRequestException(
        'Cannot place both Buy and Sell orders for the same symbol simultaneously.',
      );
    }

    const freeVolume = await this.getFreeHoldingVolume(dto.cd_code, dto.symbol_id);
    if (dto.order_size > freeVolume) {
      throw new BadRequestException(
        `Insufficient shares. Available: ${this.roundTo(freeVolume, 2)}`,
      );
    }

    const brokerContext = await this.getBrokerInstitutionContext(dto.order_entry);
    const { commission, gst, totalAmount } = this.calculatePlacementAmounts(
      dto.price,
      dto.order_size,
      brokerContext.gstRegister,
    );

    const institutionId =
      brokerContext.institutionId ??
      (await this.getInstitutionIdByCdCode(dto.cd_code));
    const flagId = this.generateFlagId();
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.insertBondOrderAudit(queryRunner, dto, flagId, commission);

      const insertOrderQuery = `
        INSERT INTO bond_orders(
          cd_code, participant_code, order_entry, order_size, symbol_id,
          price, side, commis_amt, flag_id, member_broker,
          sell_vol, buy_vol, acc_intrt, dirty_price, ytm, order_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(insertOrderQuery, [
        dto.cd_code.trim(),
        dto.participant_code.trim(),
        dto.order_entry.trim(),
        dto.order_size,
        dto.symbol_id,
        dto.price,
        dto.side,
        commission,
        flagId,
        dto.participant_code.trim(),
        dto.order_size,
        0,
        dto.acc_intrt,
        dto.dirty_price,
        dto.ytm,
        dto.order_type.trim(),
      ]);

      const remarks = `Bond Sell Order entry by user ${dto.order_entry.trim()} of member ${dto.participant_code.trim()} volume ${dto.order_size} @ Nu. ${dto.price}`;
      const insertFinanceQuery = `
        INSERT INTO bbo_finance (
          cd_code, user_name, remarks, flag, institution_id, flag_id, status, amount, symbol_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(insertFinanceQuery, [
        dto.cd_code.trim(),
        dto.order_entry.trim(),
        remarks,
        0,
        institutionId,
        flagId,
        0,
        totalAmount,
        dto.symbol_id,
      ]);

      const updateHoldingQuery = `
        UPDATE cds_holding
        SET volume = volume - ?, pending_out_vol = pending_out_vol + ?
        WHERE cd_code = ? AND symbol_id = ?
      `;
      await queryRunner.query(updateHoldingQuery, [
        dto.order_size,
        dto.order_size,
        dto.cd_code.trim(),
        dto.symbol_id,
      ]);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.tryMatchBondTrade();

    return {
      message: 'Sell Order Placed Successfully.',
      flag_id: flagId,
      commission: this.roundTo(commission, 2),
      gst: this.roundTo(gst, 2),
      total_amount: this.roundTo(totalAmount, 2),
    };
  }

  async getPendingOrders(cdCode: string): Promise<BondPendingOrdersResponseDto> {
    const query = `
      SELECT a.id AS order_id, a.cd_code, a.participant_code, a.member_broker,
             a.order_size, a.order_entry, a.flag_id, a.sell_vol, a.buy_vol,
             a.price, a.side, a.commis_amt, a.order_date, a.acc_intrt,
             a.dirty_price, a.ytm, b.symbol, b.symbol_id, b.security_type
      FROM bond_orders a
      INNER JOIN symbol b ON a.symbol_id = b.symbol_id
      WHERE a.cd_code = ?
      ORDER BY a.order_date DESC
    `;
    const rows = await this.cms22DataSource.query(query, [cdCode.trim()]);
    const data: BondPendingOrderItemDto[] = rows.map((row: Record<string, unknown>) => ({
      order_id: Number(row.order_id),
      cd_code: String(row.cd_code ?? ''),
      participant_code: String(row.participant_code ?? ''),
      member_broker: String(row.member_broker ?? ''),
      order_size: Number(row.order_size ?? 0),
      order_entry: String(row.order_entry ?? ''),
      flag_id: String(row.flag_id ?? ''),
      sell_vol: Number(row.sell_vol ?? 0),
      buy_vol: Number(row.buy_vol ?? 0),
      price: Number(row.price ?? 0),
      side: String(row.side ?? ''),
      commis_amt: Number(row.commis_amt ?? 0),
      order_date: row.order_date
        ? new Date(String(row.order_date))
            .toISOString()
            .replace('T', ' ')
            .substring(0, 19)
        : '',
      acc_intrt: Number(row.acc_intrt ?? 0),
      dirty_price: Number(row.dirty_price ?? 0),
      ytm: Number(row.ytm ?? 0),
      symbol: String(row.symbol ?? ''),
      symbol_id: Number(row.symbol_id ?? 0),
      security_type: String(row.security_type ?? ''),
    }));
    return { data, count: data.length };
  }

  async getBondExecutedHistory(
    cdCode: string,
  ): Promise<BondExecutedHistoryResponseDto> {
    const query = `
      SELECT b.id, b.cd_code, b.participant_code, b.sub_user, b.member_broker,
             b.order_date, b.symbol_id, b.order_exe_price, b.lot_size_execute,
             b.status, b.side, b.lot_check, b.flag_id, b.dirty_price,
             b.accur_rate, b.ytm, b.order_type, b.created_at,
             s.symbol, s.name, s.security_type
      FROM bond_executed_orders b
      LEFT JOIN symbol s ON b.symbol_id = s.symbol_id
      WHERE b.cd_code = ?
      ORDER BY b.order_date DESC, b.id DESC
    `;
    const rows = await this.cms22DataSource.query(query, [cdCode.trim()]);
    const data: BondExecutedHistoryItemDto[] = rows.map(
      (row: Record<string, unknown>) => ({
        id: Number(row.id ?? 0),
        cd_code: String(row.cd_code ?? ''),
        participant_code: String(row.participant_code ?? ''),
        sub_user: String(row.sub_user ?? ''),
        member_broker: String(row.member_broker ?? ''),
        order_date: this.formatDbDateTime(row.order_date),
        symbol_id: Number(row.symbol_id ?? 0),
        symbol: String(row.symbol ?? ''),
        name: String(row.name ?? ''),
        security_type: String(row.security_type ?? ''),
        order_exe_price: Number(row.order_exe_price ?? 0),
        lot_size_execute: Number(row.lot_size_execute ?? 0),
        status: Number(row.status ?? 0),
        side: String(row.side ?? '').trim(),
        lot_check: Number(row.lot_check ?? 0),
        flag_id: String(row.flag_id ?? ''),
        dirty_price: Number(row.dirty_price ?? 0),
        accur_rate: Number(row.accur_rate ?? 0),
        ytm: Number(row.ytm ?? 0),
        order_type: String(row.order_type ?? ''),
        created_at: this.formatDbDateTime(row.created_at),
      }),
    );
    return { data, count: data.length };
  }

  async getBondOrderbook(symbolId: number): Promise<BondOrderbookResponseDto> {
    const query = `
      SELECT
        o.price,
        SUM(
          CASE
            WHEN LOWER(TRIM(IFNULL(o.side, ''))) = 'b' THEN COALESCE(NULLIF(o.buy_vol, 0), o.order_size, 0)
            WHEN o.buy_vol > 0 AND (o.sell_vol IS NULL OR o.sell_vol = 0) THEN o.buy_vol
            ELSE 0
          END
        ) AS buy_vol,
        SUM(
          CASE
            WHEN LOWER(TRIM(IFNULL(o.side, ''))) = 's' THEN COALESCE(NULLIF(o.sell_vol, 0), o.order_size, 0)
            WHEN o.sell_vol > 0 AND (o.buy_vol IS NULL OR o.buy_vol = 0) THEN o.sell_vol
            ELSE 0
          END
        ) AS sell_vol
      FROM bond_orders o
      INNER JOIN symbol s ON o.symbol_id = s.symbol_id
      WHERE o.symbol_id = ?
        AND o.order_type = 'OTC'
        AND o.status IN ('OPEN', 'PENDING', 'UPDATED')
      GROUP BY o.price
      HAVING buy_vol > 0 OR sell_vol > 0
      ORDER BY o.price DESC
    `;

    const rows = await this.cms22DataSource.query(query, [symbolId]);
    const data = rows.map((row: Record<string, unknown>) => ({
      price: Number(row.price ?? 0),
      buy_vol: Number(row.buy_vol ?? 0),
      sell_vol: Number(row.sell_vol ?? 0),
    }));

    return { data, count: data.length };
  }

  async updateBondOrder(
    cdCode: string,
    dto: BondUpdateOrderRequestDto,
  ): Promise<BondUpdateOrderResponseDto> {
    if (dto.order_size % 10 !== 0) {
      throw new BadRequestException('Volume should be multiple of 10.');
    }
    if (!this.hasAtMostTwoDecimals(dto.price)) {
      throw new BadRequestException('Price should be at most 2 decimal places.');
    }

    const existing = await this.loadBondOrderForUpdate(
      dto.order_id,
      dto.flag_id,
      cdCode,
    );
    if (existing.side !== dto.side || existing.symbol_id !== dto.symbol_id) {
      throw new BadRequestException('Order details do not match.');
    }

    const oldVol = existing.side === 'S' ? existing.sell_vol : existing.buy_vol;
    if (Number(existing.order_size) - oldVol !== 0) {
      throw new BadRequestException('Only fully open orders can be updated.');
    }

    const { commission, gst, totalAmount } = this.calculatePlacementAmounts(
      dto.price,
      dto.order_size,
      existing.gst_register,
    );

    if (existing.side === 'B') {
      const balanceRows = await this.cms22DataSource.query(
        `
          SELECT COALESCE(SUM(m.amount), 0) AS total_amount
          FROM bbo_finance m
          WHERE m.cd_code = ? AND m.flag_id != ?
        `,
        [cdCode, dto.flag_id],
      );
      const available = Number(balanceRows[0]?.total_amount ?? 0);
      if (totalAmount > available) {
        throw new BadRequestException(
          `Insufficient cash. Available: ${this.roundTo(available, 2)}`,
        );
      }
    } else {
      const holdingRows = await this.cms22DataSource.query(
        `
          SELECT h.volume, h.pending_out_vol
          FROM cds_holding h
          WHERE h.cd_code = ? AND h.symbol_id = ?
          LIMIT 1
        `,
        [cdCode, dto.symbol_id],
      );
      if (!holdingRows.length) {
        throw new BadRequestException('Insufficient shares. Available: 0');
      }
      const volume = Number(holdingRows[0].volume ?? 0);
      const pendingOut = Number(holdingRows[0].pending_out_vol ?? 0);
      const freeVolume = volume - pendingOut + oldVol;
      if (dto.order_size > freeVolume) {
        throw new BadRequestException(
          `Insufficient shares. Available: ${this.roundTo(freeVolume, 2)}`,
        );
      }
    }

    const newBuyVol = existing.side === 'B' ? dto.order_size : existing.buy_vol;
    const newSellVol = existing.side === 'S' ? dto.order_size : existing.sell_vol;
    const financeAmount = existing.side === 'B' ? -totalAmount : totalAmount;
    const remarks = `Bond ${existing.side === 'B' ? 'Buy' : 'Sell'} Order updated by user ${existing.order_entry} volume ${dto.order_size} @ Nu. ${dto.price}`;

    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (existing.side === 'S') {
        const holdingRows = await queryRunner.query(
          `
            SELECT h.volume, h.pending_out_vol
            FROM cds_holding h
            WHERE h.cd_code = ? AND h.symbol_id = ?
            LIMIT 1
          `,
          [cdCode, dto.symbol_id],
        );
        const volume = Number(holdingRows[0]?.volume ?? 0);
        const pendingOut = Number(holdingRows[0]?.pending_out_vol ?? 0);
        const newPendingOut = pendingOut - oldVol + dto.order_size;
        const newVolume = volume + oldVol - dto.order_size;
        await queryRunner.query(
          `
            UPDATE cds_holding
            SET pending_out_vol = ?, volume = ?
            WHERE cd_code = ? AND symbol_id = ?
          `,
          [newPendingOut, newVolume, cdCode, dto.symbol_id],
        );
      }

      await queryRunner.query(
        `
          UPDATE bbo_finance
          SET remarks = ?, amount = ?
          WHERE flag_id = ? AND flag = 0
        `,
        [remarks, financeAmount, dto.flag_id],
      );

      await this.insertBondOrderAudit(
        queryRunner,
        {
          cd_code: cdCode,
          participant_code: existing.participant_code,
          order_entry: existing.order_entry,
          order_size: dto.order_size,
          symbol_id: dto.symbol_id,
          price: dto.price,
          side: existing.side,
          acc_intrt: dto.acc_intrt,
          dirty_price: dto.dirty_price,
          ytm: dto.ytm,
          order_type: existing.order_type,
        },
        dto.flag_id,
        commission,
        'UPDATED',
        newBuyVol,
        newSellVol,
      );

      await queryRunner.query(
        `
          UPDATE bond_orders
          SET sell_vol = CASE WHEN side = 'S' THEN ? ELSE sell_vol END,
              buy_vol = CASE WHEN side = 'B' THEN ? ELSE buy_vol END,
              order_size = ?,
              price = ?,
              commis_amt = ?,
              acc_intrt = ?,
              dirty_price = ?,
              ytm = ?,
              status = 'UPDATED'
          WHERE id = ? AND flag_id = ? AND cd_code = ?
        `,
        [
          newSellVol,
          newBuyVol,
          dto.order_size,
          dto.price,
          commission,
          dto.acc_intrt,
          dto.dirty_price,
          dto.ytm,
          dto.order_id,
          dto.flag_id,
          cdCode,
        ],
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.tryMatchBondTrade();

    return {
      message: 'Order updated successfully.',
      commission: this.roundTo(commission, 2),
      gst: this.roundTo(gst, 2),
      total_amount: this.roundTo(totalAmount, 2),
    };
  }

  async cancelBondOrder(
    cdCode: string,
    dto: BondCancelOrderRequestDto,
  ): Promise<BondCancelOrderResponseDto> {
    const orderRows = await this.cms22DataSource.query(
      `
        SELECT b.id, b.order_size, b.sell_vol, b.buy_vol, b.cd_code, b.symbol_id,
               b.side, b.order_entry, b.participant_code, b.member_broker,
               b.price, b.commis_amt, b.acc_intrt, b.dirty_price, b.ytm, b.order_type
        FROM bond_orders b
        WHERE b.id = ? AND b.symbol_id = ? AND b.side = ? AND b.flag_id = ? AND b.cd_code = ?
        LIMIT 1
      `,
      [dto.order_id, dto.symbol_id, dto.side, dto.flag_id, cdCode],
    );
    if (!orderRows.length) {
      throw new NotFoundException('Order not found.');
    }
    const order = orderRows[0] as Record<string, unknown>;
    const volCol =
      dto.side === 'S' ? Number(order.sell_vol ?? 0) : Number(order.buy_vol ?? 0);
    const orderSize = Number(order.order_size ?? 0);
    if (orderSize - volCol !== 0) {
      throw new BadRequestException('Only fully open orders can be cancelled.');
    }

    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (dto.side === 'S') {
        const holdingRows = await queryRunner.query(
          `
            SELECT pending_out_vol, volume
            FROM cds_holding
            WHERE symbol_id = ? AND cd_code = ?
            LIMIT 1
          `,
          [dto.symbol_id, cdCode],
        );
        if (!holdingRows.length) {
          throw new BadRequestException('Holding record not found for sell cancel.');
        }
        const pendingOut = Number(holdingRows[0].pending_out_vol ?? 0);
        const volume = Number(holdingRows[0].volume ?? 0);
        await queryRunner.query(
          `
            UPDATE cds_holding
            SET pending_out_vol = ?, volume = ?
            WHERE cd_code = ? AND symbol_id = ?
          `,
          [pendingOut - volCol, volume + volCol, cdCode, dto.symbol_id],
        );
      }

      await queryRunner.query(
        `
          UPDATE bond_orders
          SET status = 'DELETED'
          WHERE flag_id = ? AND id = ? AND symbol_id = ? AND cd_code = ?
        `,
        [dto.flag_id, dto.order_id, dto.symbol_id, cdCode],
      );

      await queryRunner.query(
        `
          INSERT INTO bond_order_audits (
            cd_code, participant_code, order_entry, order_size, symbol_id,
            price, side, commis_amt, flag_id, member_broker, sell_vol, buy_vol,
            acc_intrt, dirty_price, ytm, order_type, status
          )
          SELECT
            cd_code, participant_code, order_entry, order_size, symbol_id,
            price, side, commis_amt, flag_id, member_broker, sell_vol, buy_vol,
            acc_intrt, dirty_price, ytm, order_type, 'DELETED'
          FROM bond_orders
          WHERE id = ?
        `,
        [dto.order_id],
      );

      await queryRunner.query(
        `DELETE FROM bond_orders WHERE id = ? AND cd_code = ?`,
        [dto.order_id, cdCode],
      );

      await queryRunner.query(
        `
          DELETE FROM bbo_finance
          WHERE flag_id = ? AND cd_code = ? AND flag = 0
        `,
        [dto.flag_id, cdCode],
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return { message: 'Order cancelled successfully.' };
  }

  private async loadBondOrderForUpdate(
    orderId: number,
    flagId: string,
    cdCode: string,
  ): Promise<{
    side: 'B' | 'S';
    symbol_id: number;
    order_size: number;
    buy_vol: number;
    sell_vol: number;
    order_entry: string;
    participant_code: string;
    order_type: string;
    gst_register: string;
  }> {
    const rows = await this.cms22DataSource.query(
      `
        SELECT o.price, o.order_size, o.acc_intrt, o.dirty_price, o.ytm, o.order_type,
               o.side, o.cd_code, o.symbol_id, o.buy_vol, o.sell_vol, o.order_entry,
               o.participant_code, COALESCE(b.gst_register, 'N') AS gst_register
        FROM bond_orders o
        LEFT JOIN adm_participants a ON o.participant_code = a.participant_code
        LEFT JOIN adm_institution b ON a.institution_id = b.institution_id
        WHERE o.id = ? AND o.flag_id = ? AND o.cd_code = ?
        LIMIT 1
      `,
      [orderId, flagId, cdCode],
    );
    if (!rows.length) {
      throw new NotFoundException('Order not found.');
    }
    const row = rows[0] as Record<string, unknown>;
    return {
      side: String(row.side) as 'B' | 'S',
      symbol_id: Number(row.symbol_id),
      order_size: Number(row.order_size),
      buy_vol: Number(row.buy_vol ?? 0),
      sell_vol: Number(row.sell_vol ?? 0),
      order_entry: String(row.order_entry ?? ''),
      participant_code: String(row.participant_code ?? ''),
      order_type: String(row.order_type ?? 'OTC'),
      gst_register: String(row.gst_register ?? 'N').trim().toUpperCase(),
    };
  }

  private async isBondMarketOpen(): Promise<boolean> {
    const now = this.getThimphuNowParts();
    const dayName = now.weekday;
    if (dayName === 'Sat' || dayName === 'Sun') {
      return false;
    }

    const holidayQuery = `SELECT 1 FROM holiday WHERE holiday_date = ? LIMIT 1`;
    const holidayRows = await this.cms22DataSource.query(holidayQuery, [now.date]);
    if (holidayRows.length > 0) {
      return false;
    }

    const hhmm = now.time;
    const inMorning = hhmm >= '09:00' && hhmm <= '13:00';
    const inAfternoon = hhmm >= '14:00' && hhmm <= '15:00';
    return inMorning || inAfternoon;
  }

  private async getAccountMeta(cdCode: string): Promise<{ accType: string }> {
    const query = `
      SELECT COALESCE(acc_type, '') AS acc_type
      FROM client_account
      WHERE cd_code = ?
      LIMIT 1
    `;
    const rows = await this.cms22DataSource.query(query, [cdCode]);
    if (!rows.length) {
      return { accType: '' };
    }
    return {
      accType: String(rows[0].acc_type || '').trim().toUpperCase(),
    };
  }

  private async getBrokerInstitutionContext(username: string): Promise<{
    institutionId: number | null;
    participantCode: string | null;
    gstRegister: string;
  }> {
    const query = `
      SELECT a.institution_id, c.participant_code, a.gst_register
      FROM users c
      JOIN adm_participants b ON c.participant_code = b.participant_code
      JOIN adm_institution a ON b.institution_id = a.institution_id
      WHERE c.username = ?
      LIMIT 1
    `;
    const rows = await this.cms22DataSource.query(query, [username.trim()]);
    if (!rows.length) {
      return { institutionId: null, participantCode: null, gstRegister: 'N' };
    }
    return {
      institutionId:
        rows[0].institution_id == null ? null : Number(rows[0].institution_id),
      participantCode: rows[0].participant_code
        ? String(rows[0].participant_code)
        : null,
      gstRegister: String(rows[0].gst_register || 'N').trim().toUpperCase(),
    };
  }

  private calculatePlacementAmounts(
    price: number,
    volume: number,
    gstRegister: string,
  ): { tradeValue: number; commission: number; gst: number; totalAmount: number } {
    const tradeValue = price * volume;
    const commission = this.calculateCommission(tradeValue);
    const gst =
      gstRegister === 'Y' ? this.roundTo(commission * 0.05, 2) : 0;
    const totalAmount = this.roundTo(tradeValue + commission + gst, 2);
    return { tradeValue, commission, gst, totalAmount };
  }

  private async getInstitutionIdByCdCode(cdCode: string): Promise<number | null> {
    const query = `
      SELECT b.institution_id
      FROM client_account a
      JOIN adm_participants b ON SUBSTR(a.user_name, 1, 7) = b.participant_code
      WHERE a.cd_code = ?
      LIMIT 1
    `;
    const rows = await this.cms22DataSource.query(query, [cdCode]);
    if (!rows.length || rows[0].institution_id == null) {
      return null;
    }
    return Number(rows[0].institution_id);
  }

  private async hasPendingSameSideOrder(
    cdCode: string,
    symbolId: number,
    participantCode: string,
    side: string,
  ): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM bond_orders
        WHERE cd_code = ? AND symbol_id = ? AND participant_code = ? AND side = ?
      ) AS ex
    `;
    const rows = await this.cms22DataSource.query(query, [
      cdCode,
      symbolId,
      participantCode,
      side,
    ]);
    return Boolean(Number(rows[0]?.ex || 0));
  }

  private async hasAnyPendingOrder(
    cdCode: string,
    symbolId: number,
    participantCode: string,
  ): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM bond_orders
        WHERE cd_code = ? AND symbol_id = ? AND participant_code = ?
      ) AS ex
    `;
    const rows = await this.cms22DataSource.query(query, [
      cdCode,
      symbolId,
      participantCode,
    ]);
    return Boolean(Number(rows[0]?.ex || 0));
  }

  private async getAvailableBalance(cdCode: string): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM bbo_finance
      WHERE cd_code = ?
    `;
    const rows = await this.cms22DataSource.query(query, [cdCode]);
    return Number(rows[0]?.total || 0);
  }

  private async getFreeHoldingVolume(
    cdCode: string,
    symbolId: number,
  ): Promise<number> {
    const query = `
      SELECT COALESCE(volume - pending_out_vol, 0) AS free_vol
      FROM cds_holding
      WHERE cd_code = ? AND symbol_id = ?
      LIMIT 1
    `;
    const rows = await this.cms22DataSource.query(query, [cdCode, symbolId]);
    if (!rows.length) {
      return 0;
    }
    return Number(rows[0].free_vol || 0);
  }

  private async insertBondOrderAudit(
    queryRunner: { query: (query: string, parameters?: any[]) => Promise<any> },
    dto: {
      cd_code: string;
      participant_code: string;
      order_entry: string;
      order_size: number;
      symbol_id: number;
      price: number;
      side: 'B' | 'S';
      acc_intrt: number;
      dirty_price: number;
      ytm: number;
      order_type: string;
    },
    flagId: string,
    commission: number,
    status = 'OPEN',
    buyVol?: number,
    sellVol?: number,
  ): Promise<void> {
    const resolvedBuyVol = buyVol ?? (dto.side === 'B' ? dto.order_size : 0);
    const resolvedSellVol = sellVol ?? (dto.side === 'S' ? dto.order_size : 0);
    const query = `
      INSERT INTO bond_order_audits (
        cd_code, participant_code, order_entry, order_size, symbol_id,
        price, side, commis_amt, flag_id, member_broker, sell_vol, buy_vol,
        acc_intrt, dirty_price, ytm, order_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await queryRunner.query(query, [
      dto.cd_code.trim(),
      dto.participant_code.trim(),
      dto.order_entry.trim(),
      dto.order_size,
      dto.symbol_id,
      dto.price,
      dto.side,
      commission,
      flagId,
      dto.participant_code.trim(),
      resolvedSellVol,
      resolvedBuyVol,
      dto.acc_intrt,
      dto.dirty_price,
      dto.ytm,
      dto.order_type.trim(),
      status,
    ]);
  }

  private async tryMatchBondTrade(): Promise<void> {
    try {
      await this.cms22DataSource.query('CALL try_match_bond_trade()');
    } catch {
      // Best effort to keep parity with legacy flow where matching is attempted immediately.
    }
  }

  private hasAtMostTwoDecimals(value: number): boolean {
    const normalized = Number(value);
    return Number.isInteger(normalized * 100);
  }

  private generateFlagId(): string {
    const now = new Date();
    const year = now.getFullYear().toString().substring(2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private getThimphuNowParts(): { date: string; time: string; weekday: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Thimphu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
      date: `${pick('year')}-${pick('month')}-${pick('day')}`,
      time: `${pick('hour')}:${pick('minute')}`,
      weekday: pick('weekday'),
    };
  }

  private normalizeFrequency(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return 2;
    }
    return Math.round(n);
  }

  private parseDateOrThrow(raw: unknown, message: string): Date {
    const parsed = new Date(String(raw));
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(message);
    }
    return this.startOfDay(parsed);
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return this.startOfDay(d);
  }

  private daysBetween(from: Date, to: Date): number {
    const msInDay = 1000 * 60 * 60 * 24;
    return Math.max(0, Math.round((this.startOfDay(to).getTime() - this.startOfDay(from).getTime()) / msInDay));
  }

  private isSameDay(a: Date, b: Date): boolean {
    return this.formatDate(a) === this.formatDate(b);
  }

  private formatDbDateTime(value: unknown): string {
    if (!value) {
      return '';
    }
    return new Date(String(value))
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
  }

  private roundTo(value: number, scale: number): number {
    const factor = 10 ** scale;
    return Math.round(value * factor) / factor;
  }
}
