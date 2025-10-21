import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from '../entities/symbol.entity';
import { MarketPriceHistory } from '../entities/market-price-history.entity';
import { ExecutedOrders } from '../entities/executed-orders.entity';
import { EquityMetrics } from '../entities/equity-metrics.entity';
import { Scripts } from '../entities/scripts.entity';
import { MarketDataResponseDto } from './dto/market-data-response.dto';

@Injectable()
export class MarketDataService {
  constructor(
    @InjectRepository(Symbol, 'default')
    private symbolRepository: Repository<Symbol>,
    @InjectRepository(MarketPriceHistory, 'default')
    private marketPriceHistoryRepository: Repository<MarketPriceHistory>,
    @InjectRepository(ExecutedOrders, 'default')
    private executedOrdersRepository: Repository<ExecutedOrders>,
    @InjectRepository(EquityMetrics, 'financial')
    private equityMetricsRepository: Repository<EquityMetrics>,
    @InjectRepository(Scripts, 'financial')
    private scriptsRepository: Repository<Scripts>,
  ) {}

  async getMarketData(ticker: string): Promise<MarketDataResponseDto> {
    if (!ticker || ticker.trim() === '') {
      throw new BadRequestException('Symbol is required');
    }

    // Query 1: Get Symbol ID and Paid-up Shares
    const symbolData = await this.symbolRepository
      .createQueryBuilder('symbol')
      .select(['symbol.symbol_id', 'symbol.paid_up_shares'])
      .where('symbol.symbol = :ticker', { ticker })
      .getOne();

    if (!symbolData) {
      throw new NotFoundException('Symbol not found');
    }

    const symbol_id = symbolData.symbol_id;
    const paid_up_shares = symbolData.paid_up_shares;
    
    // Query 2: Get Latest Market Price
    const marketPriceData = await this.marketPriceHistoryRepository
      .createQueryBuilder('mph')
      .select('mph.price')
      .where('mph.symbol_id = :symbol_id', { symbol_id })
      .orderBy('mph.date', 'DESC')
      .getOne();

    const marketPrice = marketPriceData?.price || 0.00;

    // Query 3: Calculate Market Capitalization (computed in code)
    const marketCap = paid_up_shares * marketPrice;

    // Query 4: Get 52-Week High and Low
    const fiftyTwoWeekData = await this.executedOrdersRepository
      .createQueryBuilder('eo')
      .select([
        'MAX(eo.order_exe_price) as fiftyTwoWeekHigh',
        'MIN(eo.order_exe_price) as fiftyTwoWeekLow'
      ])
      .where('eo.symbol_id = :symbol_id', { symbol_id })
      .andWhere('eo.order_date >= DATE_SUB(NOW(), INTERVAL 52 WEEK)')
      .getRawOne();

    // Get latest weekly traded data (High, Low, Volume) - Query 5
    const latestTradeData = await this.executedOrdersRepository
      .createQueryBuilder('eo')
      .select([
        'MAX(eo.order_exe_price) as weekHigh',
        'MIN(eo.order_exe_price) as weekLow',
        'SUM(eo.lot_size_execute) as tradedVolume'
      ])
      .where('eo.symbol_id = :symbol_id', { symbol_id })
      .andWhere("eo.side = 'B'")
      .andWhere('eo.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .getRawOne();

    // Get weekly volume (Buy side only) - Query 6
    const volumeData = await this.executedOrdersRepository
      .createQueryBuilder('eo')
      .select('SUM(eo.lot_size_execute) as volume')
      .where('eo.symbol_id = :symbol_id', { symbol_id })
      .andWhere('eo.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .andWhere("eo.side = 'B'")
      .getRawOne();

    // Get weekly open and close prices - Query 7 (exact Laravel logic)
    const weekPriceData = await this.executedOrdersRepository
      .createQueryBuilder('eo')
      .select([
        `(SELECT eo2.order_exe_price 
          FROM executed_orders eo2 
          WHERE eo2.symbol_id = :symbol_id 
          AND WEEK(eo2.order_date, 1) = WEEK(NOW(), 1) 
          AND YEAR(eo2.order_date) = YEAR(NOW())
          ORDER BY eo2.order_date ASC 
          LIMIT 1) as openPrice`,
        `(SELECT eo3.order_exe_price 
          FROM executed_orders eo3 
          WHERE eo3.symbol_id = :symbol_id 
          AND WEEK(eo3.order_date, 1) = WEEK(NOW(), 1) 
          AND YEAR(eo3.order_date) = YEAR(NOW())
          ORDER BY eo3.order_date DESC 
          LIMIT 1) as closePrice`
      ])
      .where('eo.symbol_id = :symbol_id', { symbol_id })
      .andWhere('WEEK(eo.order_date, 1) = WEEK(NOW(), 1)')
      .andWhere('YEAR(eo.order_date) = YEAR(NOW())')
      .getRawOne();

    // Get 30-Day Average Volume - Query 8
    const avgVolumeData = await this.executedOrdersRepository
      .createQueryBuilder('eo')
      .select('SUM(eo.lot_size_execute) / 30 as avgVolume')
      .where('eo.symbol_id = :symbol_id', { symbol_id })
      .andWhere('eo.order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      .andWhere("eo.side = 'B'")
      .getRawOne();

    // Get latest equity metrics - Query 9 (exact Laravel logic)
    let metricData: any = null;
    try {
      metricData = await this.equityMetricsRepository
        .createQueryBuilder('em')
        .leftJoin(Scripts, 's', 'em.script = s.symbol')
        .select([
          'em.script',
          's.name as script_name',
          'em.year',
          'em.dividend_yield',
          'em.beta',
          'em.eps',
          'em.pe_ratio'
        ])
        .where('em.script = :ticker', { ticker })
        .orderBy('em.year', 'DESC')
        .getRawOne();
      
    } catch (error) {
      console.error('Error fetching financial metrics:', error);
      metricData = null;
    }

    // Prepare response data with defaults if no metric is found
    const data: MarketDataResponseDto = {
      ticker: metricData?.em_script || metricData?.script || ticker,
      name: metricData?.script_name || 'N/A',
      dividendYield: metricData?.em_dividend_yield?.toString() || metricData?.dividend_yield?.toString() || '0.00',
      beta: metricData?.em_beta?.toString() || metricData?.beta?.toString() || '0.00',
      trailingEps: metricData?.em_eps?.toString() || metricData?.eps?.toString() || '0.00',
      pe_ratio: metricData?.em_pe_ratio?.toString() || metricData?.pe_ratio?.toString() || '0.00',
      fiftyTwoWeekHigh: fiftyTwoWeekData?.fiftyTwoWeekHigh?.toString() || '0.00',
      fiftyTwoWeekLow: fiftyTwoWeekData?.fiftyTwoWeekLow?.toString() || '0.00',
      open: weekPriceData?.openPrice?.toString() || '0.00',
      close: weekPriceData?.closePrice?.toString() || '0.00',
      weekHigh: latestTradeData?.weekHigh?.toString() || '0.00',
      weekLow: latestTradeData?.weekLow?.toString() || '0.00',
      marketPrice: marketPrice.toString(),
      marketCap: marketCap,
      volume: parseInt(volumeData?.volume) || 0,
      averageVolume: Math.round((parseFloat(avgVolumeData?.avgVolume) || 0) * 100) / 100
    };

    return data;
  }
}
