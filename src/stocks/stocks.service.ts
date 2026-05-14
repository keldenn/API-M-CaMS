import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketPrice } from '../entities/market-price.entity';
import { MarketIndex } from '../entities/market-index.entity';
import { Symbol } from '../entities/symbol.entity';
import { StockPriceDto } from './dto/stock-price.dto';
import { MarketStatsDto } from './dto/market-stats.dto';
import { StocksGateway } from './stocks.gateway';
import { FcmService } from '../fcm/fcm.service';
import { WatchlistService } from '../watchlist/watchlist.service';

@Injectable()
export class StocksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StocksService.name);
  private priceCheckInterval: NodeJS.Timeout;
  private lastPrices: Map<string, number> = new Map();
  private readonly CHECK_INTERVAL = 5000; // Check every 5 seconds

  constructor(
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(MarketIndex)
    private readonly marketIndexRepository: Repository<MarketIndex>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @Inject(forwardRef(() => StocksGateway))
    private stocksGateway: StocksGateway,
    private readonly fcmService: FcmService,
    private readonly watchlistService: WatchlistService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing stocks service...');
    // Initialize last prices
    const stockPrices = await this.getAllStockPrices();
    stockPrices.forEach((stock) => {
      this.lastPrices.set(stock.symbol, stock.currentPrice);
    });

    // Start monitoring price changes
    this.startPriceMonitoring();
  }

  onModuleDestroy() {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
    }
  }

  async getAllStockPrices(): Promise<StockPriceDto[]> {
    const query = `
      SELECT 
        symbol.symbol AS symbol,
        symbol.name AS name,
        market_price.market_price AS currentPrice,
        market_price.market_price - market_price.ex_market_price AS priceChange,
        market_price.date AS timestamp
      FROM market_price
      JOIN symbol ON market_price.symbol_id = symbol.symbol_id
      WHERE symbol.security_type = 'OS'
        AND symbol.status = 1
        AND symbol.trsstatus IN (1, 3)
      ORDER BY symbol.symbol ASC
    `;

    const results = await this.marketPriceRepository.query(query);

    return results.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      currentPrice: parseFloat(row.currentPrice),
      priceChange: parseFloat(row.priceChange),
      timestamp: row.timestamp,
    }));
  }

  private startPriceMonitoring() {
    this.priceCheckInterval = setInterval(async () => {
      try {
        const currentPrices = await this.getAllStockPrices();
        const changedPrices = this.detectPriceChanges(currentPrices);

        if (changedPrices.length > 0) {
          this.logger.log(
            `Price changes detected for ${changedPrices.length} stocks`,
          );
          // Broadcast all prices (or just changed ones, depending on your needs)
          this.stocksGateway.broadcastPriceUpdate(currentPrices);

          const snapshots = changedPrices.map((stock) => ({
            stock,
            previousPrice: this.lastPrices.get(stock.symbol),
          }));
          void this.notifyWatchlistSubscribers(snapshots).catch((err) =>
            this.logger.error('Watchlist FCM notification failed', err),
          );

          // Update last known prices
          currentPrices.forEach((stock) => {
            this.lastPrices.set(stock.symbol, stock.currentPrice);
          });
        }
      } catch (error) {
        this.logger.error('Error checking price changes:', error);
      }
    }, this.CHECK_INTERVAL);

    this.logger.log(
      `Started price monitoring (interval: ${this.CHECK_INTERVAL}ms)`,
    );
  }

  private detectPriceChanges(currentPrices: StockPriceDto[]): StockPriceDto[] {
    const changedPrices: StockPriceDto[] = [];

    for (const stock of currentPrices) {
      const lastPrice = this.lastPrices.get(stock.symbol);
      if (lastPrice === undefined || lastPrice !== stock.currentPrice) {
        changedPrices.push(stock);
      }
    }

    return changedPrices;
  }

  /**
   * For each users_watchlist row whose symbol had a real price move, send FCM
   * to all devices registered for that cd_code (fcm_tokens).
   */
  private async notifyWatchlistSubscribers(
    snapshots: Array<{
      stock: StockPriceDto;
      previousPrice: number | undefined;
    }>,
  ): Promise<void> {
    const valid = snapshots.filter(
      (s): s is { stock: StockPriceDto; previousPrice: number } =>
        s.previousPrice !== undefined &&
        s.previousPrice !== s.stock.currentPrice,
    );
    if (!valid.length) {
      return;
    }

    const stockBySymbol = new Map(
      valid.map((s) => [s.stock.symbol.trim().toUpperCase(), s.stock]),
    );
    const previousBySymbol = new Map(
      valid.map((s) => [s.stock.symbol.trim().toUpperCase(), s.previousPrice]),
    );

    const symbols = [...stockBySymbol.keys()];
    const watchers = await this.watchlistService.findWatchersForSymbols(
      symbols,
    );
    if (!watchers.length) {
      return;
    }

    this.logger.log(
      `Watchlist FCM: ${watchers.length} subscriber(s) for ${symbols.length} changed symbol(s)`,
    );

    for (const { cd_code, symbol } of watchers) {
      const stock = stockBySymbol.get(symbol);
      const previousPrice = previousBySymbol.get(symbol);
      if (!stock || previousPrice === undefined) {
        continue;
      }

      try {
        await this.fcmService.sendWatchlistPriceNotification(cd_code, {
          symbol: stock.symbol,
          name: stock.name,
          currentPrice: stock.currentPrice,
          previousPrice,
        });
      } catch (err) {
        this.logger.warn(
          `Watchlist FCM failed for cd_code=${cd_code} symbol=${symbol}`,
          err,
        );
      }
    }
  }

  async getMarketStats(username: string): Promise<MarketStatsDto> {
    const query = `
      SELECT 
        (SELECT market_cap 
         FROM market_index 
         ORDER BY created_date DESC 
         LIMIT 1) AS market_cap,
        (SELECT COUNT(*) 
         FROM symbol 
         WHERE security_type = 'OS' 
           AND status = 1 
           AND trsstatus IN (1, 3)) AS total_listed_scripts,
        (SELECT COALESCE(SUM(CASE WHEN f.status = 1 THEN f.amount ELSE 0 END), 0)
         FROM bbo_finance f
         JOIN linkuser l ON l.client_code = f.cd_code
         WHERE l.username = ?) AS totExposure
    `;

    const result = await this.marketIndexRepository.query(query, [username]);

    return {
      market_cap: result[0]?.market_cap ? parseFloat(result[0].market_cap) : 0,
      total_listed_scripts: parseInt(result[0]?.total_listed_scripts) || 0,
      totExposure: parseFloat(result[0]?.totExposure) || 0,
    };
  }
}
