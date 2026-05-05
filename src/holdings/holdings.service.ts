import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CdsHolding } from '../entities/cds-holding.entity';
import { Symbol } from '../entities/symbol.entity';
import { BboFinance } from '../entities/bbo-finance.entity';
import { MarketPrice } from '../entities/market-price.entity';
import { HoldingsResponseDto } from './dto/holdings-response.dto';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

@Injectable()
export class HoldingsService {
  constructor(
    @InjectRepository(CdsHolding)
    private cdsHoldingRepository: Repository<CdsHolding>,
    @InjectRepository(Symbol)
    private symbolRepository: Repository<Symbol>,
    @InjectRepository(BboFinance)
    private bboFinanceRepository: Repository<BboFinance>,
    @InjectRepository(MarketPrice)
    private marketPriceRepository: Repository<MarketPrice>,
  ) {}

  async getHoldingsByCdCode(cdCode: string): Promise<HoldingsResponseDto[]> {
    try {
      const query = `
        SELECT 
          s.symbol, 
          s.security_type,
          h.volume, 
          h.pending_out_vol, 
          h.pending_in_vol, 
          h.pledge_volume, 
          h.block_volume,
          (h.volume + h.pending_out_vol + h.pledge_volume + h.block_volume) as total
        FROM cds_holding h 
        JOIN symbol s ON h.symbol_id = s.symbol_id 
        WHERE h.cd_code = ? 
        AND s.status = 1
      `;

      const result = await this.cdsHoldingRepository.query(query, [cdCode]);

      if (!result || result.length === 0) {
        return [];
      }

      return result.map((row) => ({
        symbol: row.symbol,
        security_type: row.security_type,
        volume: parseFloat(row.volume) || 0,
        pending_out_vol: parseFloat(row.pending_out_vol) || 0,
        pending_in_vol: parseFloat(row.pending_in_vol) || 0,
        pledge_volume: parseFloat(row.pledge_volume) || 0,
        block_volume: parseFloat(row.block_volume) || 0,
        total: parseFloat(row.total) || 0,
      }));
    } catch (error) {
      console.error('Error fetching holdings:', error);
      throw new Error('Failed to fetch holdings data');
    }
  }

  async getPortfolioStats(username: string): Promise<PortfolioStatsDto> {
    try {
      const query = `
        SELECT 
          SUM(CASE WHEN f.status = 1 THEN f.amount ELSE 0 END) AS totExposure,
          SUM(CASE WHEN f.status = 1 AND f.flag = 3 THEN f.amount * -1 ELSE 0 END) AS totbuy,
          SUM(CASE WHEN f.status = 1 AND f.flag = 2 THEN f.amount ELSE 0 END) AS totsell,
          (
            SELECT COUNT(*) 
            FROM cds_holding h 
            JOIN symbol s ON s.symbol_id = h.symbol_id
            JOIN linkuser lu2 ON h.cd_code = lu2.client_code 
            WHERE lu2.username = ? 
              AND h.volume > 0
              AND s.status = 1
              AND s.security_type = 'OS'
          ) AS total_holdings_count,
          (
            SELECT COALESCE(SUM(h.volume * mp.market_price), 0)
            FROM cds_holding h
            JOIN symbol s ON s.symbol_id = h.symbol_id
            JOIN linkuser lu3 ON h.cd_code = lu3.client_code
            JOIN (
              SELECT mp1.symbol_id, mp1.market_price
              FROM market_price mp1
              INNER JOIN (
                SELECT symbol_id, MAX(date) AS latest_date
                FROM market_price
                GROUP BY symbol_id
              ) latest
                ON latest.symbol_id = mp1.symbol_id
                AND latest.latest_date = mp1.date
            ) mp ON mp.symbol_id = h.symbol_id
            WHERE lu3.username = ?
              AND h.volume > 0
              AND s.status = 1
              AND s.security_type = 'OS'
          ) AS current_market_value
        FROM bbo_finance f
        JOIN linkuser l ON l.client_code = f.cd_code
        WHERE l.username = ?
      `;

      const result = await this.marketPriceRepository.query(query, [
        username,
        username,
        username,
      ]);
      const stats = result[0] || {};

      return {
        totExposure: parseFloat(stats.totExposure) || 0,
        totbuy: parseFloat(stats.totbuy) || 0,
        totsell: parseFloat(stats.totsell) || 0,
        total_holdings_count: parseInt(stats.total_holdings_count) || 0,
        current_market_value: parseFloat(stats.current_market_value) || 0,
      };
    } catch (error) {
      console.error('Error fetching portfolio stats:', error);
      throw new Error('Failed to fetch portfolio statistics');
    }
  }
}
