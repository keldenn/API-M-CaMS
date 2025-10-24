import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketPriceHistory } from '../entities/market-price-history.entity';
import { Symbol } from '../entities/symbol.entity';
import { L5PriceDto } from './dto/l5price.dto';
import { L5PriceGateway } from './l5price.gateway';

@Injectable()
export class L5PriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(L5PriceService.name);
  private l5PriceCheckInterval: NodeJS.Timeout;
  private lastL5PriceData: L5PriceDto[] = [];
  private readonly CHECK_INTERVAL = 60000; // Check every 60 seconds

  constructor(
    @InjectRepository(MarketPriceHistory)
    private readonly marketPriceHistoryRepository: Repository<MarketPriceHistory>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @Inject(forwardRef(() => L5PriceGateway))
    private l5PriceGateway: L5PriceGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing L5price service...');
    // Start monitoring L5price changes
    this.startL5PriceMonitoring();
  }

  onModuleDestroy() {
    if (this.l5PriceCheckInterval) {
      clearInterval(this.l5PriceCheckInterval);
    }
  }

  async getL5PriceData(): Promise<L5PriceDto[]> {
    const query = `
      WITH ranked_prices AS (
        SELECT 
          mph.symbol_id,
          s.symbol,
          s.security_type,
          s.status,
          mph.price,
          mph.date,
          ROW_NUMBER() OVER (
            PARTITION BY DATE(mph.date), mph.symbol_id
            ORDER BY mph.date DESC
          ) AS daily_rank
        FROM market_price_history AS mph
        INNER JOIN symbol AS s 
          ON s.symbol_id = mph.symbol_id
        WHERE s.security_type = 'OS'
          AND s.status = 1
      ),
      distinct_daily AS (
        SELECT 
          symbol_id,
          symbol,
          price,
          date,
          ROW_NUMBER() OVER (
            PARTITION BY symbol_id
            ORDER BY date DESC
          ) AS day_rank
        FROM ranked_prices
        WHERE daily_rank = 1
      )
      SELECT 
        symbol,
        price,
        date
      FROM distinct_daily
      WHERE day_rank <= 5
      ORDER BY symbol, date DESC;
    `;

    this.logger.log('Fetching latest 5 days price movement data for all listed companies');
    const results = await this.marketPriceHistoryRepository.query(query);
    
    this.logger.log(`Query returned ${results.length} records`);
    
    const l5PriceData = results.map((row) => ({
      symbol: row.symbol,
      price: parseFloat(row.price),
      date: new Date(row.date),
    }));

    // Log sample data for debugging
    if (l5PriceData.length > 0) {
      this.logger.log(`Sample data: First record - Symbol: ${l5PriceData[0].symbol}, Price: ${l5PriceData[0].price}, Date: ${l5PriceData[0].date}`);
    } else {
      this.logger.warn('No L5price data found');
    }
    
    return l5PriceData;
  }

  private startL5PriceMonitoring() {
    this.l5PriceCheckInterval = setInterval(async () => {
      try {
        // Only check if there are connected clients
        if (this.l5PriceGateway.getConnectedClientsCount() > 0) {
          const currentL5PriceData = await this.getL5PriceData();

          // Check if L5price data has changed
          if (this.hasL5PriceDataChanged(this.lastL5PriceData, currentL5PriceData)) {
            this.logger.log('L5price data changes detected');
            
            // Broadcast update to all connected clients
            this.l5PriceGateway.broadcastL5PriceUpdate(currentL5PriceData);
            
            // Update last known L5price data
            this.lastL5PriceData = currentL5PriceData;
          }
        }
      } catch (error) {
        this.logger.error('Error checking L5price data changes:', error);
      }
    }, this.CHECK_INTERVAL);

    this.logger.log(`Started L5price monitoring (interval: ${this.CHECK_INTERVAL}ms)`);
  }

  private hasL5PriceDataChanged(
    lastData: L5PriceDto[],
    currentData: L5PriceDto[]
  ): boolean {
    if (!lastData || lastData.length !== currentData.length) {
      return true;
    }

    // Compare each L5price entry
    for (let i = 0; i < currentData.length; i++) {
      const last = lastData[i];
      const current = currentData[i];
      
      if (last.symbol !== current.symbol ||
          last.price !== current.price || 
          last.date.getTime() !== current.date.getTime()) {
        return true;
      }
    }

    return false;
  }

  // Method to manually trigger L5price check
  async checkL5PriceData(): Promise<void> {
    try {
      const currentL5PriceData = await this.getL5PriceData();

      if (this.hasL5PriceDataChanged(this.lastL5PriceData, currentL5PriceData)) {
        this.logger.log('Manual L5price check - changes detected');
        
        // Broadcast update to all connected clients
        this.l5PriceGateway.broadcastL5PriceUpdate(currentL5PriceData);
        
        // Update last known L5price data
        this.lastL5PriceData = currentL5PriceData;
      }
    } catch (error) {
      this.logger.error('Error checking L5price data:', error);
    }
  }
}
