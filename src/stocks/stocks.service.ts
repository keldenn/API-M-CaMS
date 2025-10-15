import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketPrice } from '../entities/market-price.entity';
import { Symbol } from '../entities/symbol.entity';
import { StockPriceDto } from './dto/stock-price.dto';
import { StocksGateway } from './stocks.gateway';

@Injectable()
export class StocksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StocksService.name);
  private priceCheckInterval: NodeJS.Timeout;
  private lastPrices: Map<string, number> = new Map();
  private readonly CHECK_INTERVAL = 5000; // Check every 5 seconds

  constructor(
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @Inject(forwardRef(() => StocksGateway))
    private stocksGateway: StocksGateway,
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
          this.logger.log(`Price changes detected for ${changedPrices.length} stocks`);
          // Broadcast all prices (or just changed ones, depending on your needs)
          this.stocksGateway.broadcastPriceUpdate(currentPrices);
          
          // Update last known prices
          currentPrices.forEach((stock) => {
            this.lastPrices.set(stock.symbol, stock.currentPrice);
          });
        }
      } catch (error) {
        this.logger.error('Error checking price changes:', error);
      }
    }, this.CHECK_INTERVAL);

    this.logger.log(`Started price monitoring (interval: ${this.CHECK_INTERVAL}ms)`);
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
}

