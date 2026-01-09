import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from '../entities/symbol.entity';
import { MarketPriceHistory } from '../entities/market-price-history.entity';
import { ExecutedOrders } from '../entities/executed-orders.entity';
import { EquityMetrics } from '../entities/equity-metrics.entity';
import { Scripts } from '../entities/scripts.entity';
import { FetchMarketDataResponseDto } from './dto/fetch-market-data-response.dto';

@Injectable()
export class CompanyService {
  constructor(
    // Use 'cms22' connection for mysql2 database (Symbol, MarketPriceHistory, ExecutedOrders)
    @InjectRepository(Symbol, 'cms22')
    private symbolRepository: Repository<Symbol>,
    @InjectRepository(MarketPriceHistory, 'cms22')
    private marketPriceHistoryRepository: Repository<MarketPriceHistory>,
    @InjectRepository(ExecutedOrders, 'cms22')
    private executedOrdersRepository: Repository<ExecutedOrders>,
    // Use 'financial' connection for officesite (mysql) database (EquityMetrics, Scripts)
    @InjectRepository(EquityMetrics, 'financial')
    private equityMetricsRepository: Repository<EquityMetrics>,
    @InjectRepository(Scripts, 'financial')
    private scriptsRepository: Repository<Scripts>,
  ) {}

  async fetchMarketData(script: string): Promise<FetchMarketDataResponseDto> {
    if (!script || script.trim() === '') {
      throw new BadRequestException('Symbol is required');
    }

    // Query 1: Get Symbol ID and Paid-up Shares from cms22 (mysql2)
    const symbolData = await this.symbolRepository
      .createQueryBuilder('symbol')
      .select(['symbol.symbol_id', 'symbol.paid_up_shares'])
      .where('symbol.symbol = :script', { script })
      .getOne();

    if (!symbolData) {
      throw new NotFoundException('Symbol not found');
    }

    const symbol_id = symbolData.symbol_id;
    const paid_up_shares = symbolData.paid_up_shares;

    // Execute all independent queries in parallel for optimal performance
    // This reduces total query time significantly by running queries concurrently
    const [
      marketPriceData,
      fiftyTwoWeekData,
      weeklyTradeData,
      weekPriceData,
      avgVolumeData,
      equityMetricsData,
    ] = await Promise.all([
      // Query 2: Get Latest Market Price from cms22 (optimized with raw SQL)
      this.getLatestMarketPrice(symbol_id),

      // Query 3: Get 52-Week High and Low from cms22 (optimized single query)
      this.getFiftyTwoWeekHighLow(symbol_id),

      // Query 4: Get Weekly High, Low, and Volume in single optimized query
      // Uses TRIM(side) to handle CHAR(1) field correctly (may have trailing spaces)
      this.getWeeklyTradeData(symbol_id),

      // Query 5: Get Weekly Open and Close Prices (optimized single query with raw SQL)
      this.getWeeklyOpenClosePrices(symbol_id),

      // Query 6: Get 30-Day Average Volume from cms22 (optimized)
      // Uses TRIM(side) to handle CHAR(1) field correctly
      this.getAverageVolume(symbol_id),

      // Query 7: Get Latest Equity Metrics with Script Name from officesite (financial/mysql)
      this.getLatestEquityMetrics(script),
    ]);

    // Calculate Market Capitalization
    const marketPrice = parseFloat(
      marketPriceData?.price?.toString() || '0',
    ) || 0.0;
    const marketCap = paid_up_shares * marketPrice;

    // Prepare response data with defaults matching Laravel logic exactly
    const data: FetchMarketDataResponseDto = {
      ticker: equityMetricsData?.em_script || equityMetricsData?.script || script,
      name: equityMetricsData?.script_name || 'N/A',
      dividendYield:
        equityMetricsData?.em_dividend_yield?.toString() ||
        equityMetricsData?.dividend_yield?.toString() ||
        '0.00',
      beta:
        equityMetricsData?.em_beta?.toString() ||
        equityMetricsData?.beta?.toString() ||
        '0.00',
      trailingEps:
        equityMetricsData?.em_eps?.toString() ||
        equityMetricsData?.eps?.toString() ||
        '0.00',
      pe_ratio:
        equityMetricsData?.em_pe_ratio?.toString() ||
        equityMetricsData?.pe_ratio?.toString() ||
        '0.00',
      fiftyTwoWeekHigh: fiftyTwoWeekData?.fiftyTwoWeekHigh?.toString() || '0.00',
      fiftyTwoWeekLow: fiftyTwoWeekData?.fiftyTwoWeekLow?.toString() || '0.00',
      open: weekPriceData?.openPrice?.toString() || '0.00',
      close: weekPriceData?.closePrice?.toString() || '0.00',
      weekHigh: weeklyTradeData?.weekHigh?.toString() || '0.00',
      weekLow: weeklyTradeData?.weekLow?.toString() || '0.00',
      marketPrice: marketPrice.toFixed(2),
      marketCap: marketCap,
      volume: parseInt(weeklyTradeData?.volume?.toString() || '0') || 0,
      averageVolume:
        Math.round(
          (parseFloat(avgVolumeData?.avgVolume?.toString() || '0') || 0) * 100,
        ) / 100,
    };

    return data;
  }

  /**
   * Get latest market price using optimized raw SQL query
   * Matches Laravel: orderBy('date', 'desc')->value('price') ?? 0.00
   */
  private async getLatestMarketPrice(symbol_id: number): Promise<{
    price?: number;
  }> {
    const query = `
      SELECT price 
      FROM market_price_history 
      WHERE symbol_id = ? 
      ORDER BY date DESC 
      LIMIT 1
    `;

    const result = await this.marketPriceHistoryRepository.manager.query(
      query,
      [symbol_id],
    );

    return result[0] || {};
  }

  /**
   * Get 52-week high and low prices using optimized raw SQL
   * Matches Laravel: selectRaw('MAX(order_exe_price) as fiftyTwoWeekHigh, MIN(order_exe_price) as fiftyTwoWeekLow')
   */
  private async getFiftyTwoWeekHighLow(symbol_id: number): Promise<{
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  }> {
    const query = `
      SELECT 
        MAX(order_exe_price) as fiftyTwoWeekHigh,
        MIN(order_exe_price) as fiftyTwoWeekLow
      FROM executed_orders
      WHERE symbol_id = ?
      AND order_date >= DATE_SUB(NOW(), INTERVAL 52 WEEK)
    `;

    const result = await this.executedOrdersRepository.manager.query(
      query,
      [symbol_id],
    );

    return result[0] || {};
  }

  /**
   * Get weekly high, low, and volume in a single optimized query
   * Matches Laravel latestTradeData query: side = 'B', last 7 days
   * Uses TRIM(side) to handle CHAR(1) field correctly (may contain trailing spaces)
   */
  private async getWeeklyTradeData(symbol_id: number): Promise<{
    weekHigh?: number;
    weekLow?: number;
    volume?: number;
  }> {
    const query = `
      SELECT 
        MAX(order_exe_price) AS weekHigh,
        MIN(order_exe_price) AS weekLow,
        SUM(lot_size_execute) AS volume
      FROM executed_orders
      WHERE symbol_id = ?
      AND TRIM(side) = 'B'
      AND order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;

    const result = await this.executedOrdersRepository.manager.query(
      query,
      [symbol_id],
    );

    return result[0] || {};
  }

  /**
   * Get weekly open and close prices in a single optimized query
   * Matches Laravel logic exactly - gets first and last order_exe_price for current week
   * Uses exe_id (correct primary key from schema) for consistent ordering
   */
  private async getWeeklyOpenClosePrices(symbol_id: number): Promise<{
    openPrice?: number;
    closePrice?: number;
  }> {
    const query = `
      SELECT 
        (SELECT order_exe_price 
         FROM executed_orders 
         WHERE symbol_id = ? 
         AND WEEK(order_date, 1) = WEEK(NOW(), 1) 
         AND YEAR(order_date) = YEAR(NOW())
         ORDER BY order_date ASC, exe_id ASC
         LIMIT 1) AS openPrice,
        (SELECT order_exe_price 
         FROM executed_orders 
         WHERE symbol_id = ? 
         AND WEEK(order_date, 1) = WEEK(NOW(), 1) 
         AND YEAR(order_date) = YEAR(NOW())
         ORDER BY order_date DESC, exe_id DESC
         LIMIT 1) AS closePrice
    `;

    const result = await this.executedOrdersRepository.manager.query(
      query,
      [symbol_id, symbol_id],
    );

    return result[0] || {};
  }

  /**
   * Get 30-day average volume using optimized raw SQL
   * Matches Laravel: SUM(lot_size_execute) / 30, side = 'B', last 30 days
   * Uses TRIM(side) to handle CHAR(1) field correctly
   */
  private async getAverageVolume(symbol_id: number): Promise<{
    avgVolume?: number;
  }> {
    const query = `
      SELECT 
        SUM(lot_size_execute) / 30 as avgVolume
      FROM executed_orders
      WHERE symbol_id = ?
      AND order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND TRIM(side) = 'B'
    `;

    const result = await this.executedOrdersRepository.manager.query(
      query,
      [symbol_id],
    );

    return result[0] || {};
  }

  /**
   * Get latest equity metrics with script name using optimized query
   * Matches Laravel: join with scripts table, order by year DESC, limit 1
   */
  private async getLatestEquityMetrics(script: string): Promise<{
    em_script?: string;
    script?: string;
    script_name?: string;
    em_dividend_yield?: number;
    dividend_yield?: number;
    em_beta?: number;
    beta?: number;
    em_eps?: number;
    eps?: number;
    em_pe_ratio?: number;
    pe_ratio?: number;
  }> {
    const result = await this.equityMetricsRepository
      .createQueryBuilder('em')
      .leftJoin(Scripts, 's', 'em.script = s.symbol')
      .select([
        'em.script',
        's.name as script_name',
        'em.year',
        'em.dividend_yield',
        'em.beta',
        'em.eps',
        'em.pe_ratio',
      ])
      .where('em.script = :script', { script })
      .orderBy('em.year', 'DESC')
      .limit(1)
      .getRawOne();

    return result || {};
  }
}

