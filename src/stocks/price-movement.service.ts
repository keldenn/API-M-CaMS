import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketPriceHistory } from '../entities/market-price-history.entity';
import { Symbol } from '../entities/symbol.entity';
import { PriceMovementDto } from './dto/price-movement.dto';
import { PriceMovementGateway } from './price-movement.gateway';

@Injectable()
export class PriceMovementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceMovementService.name);
  private priceMovementCheckInterval: NodeJS.Timeout;
  private lastPriceMovements: Map<string, PriceMovementDto[]> = new Map();
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor(
    @InjectRepository(MarketPriceHistory)
    private readonly marketPriceHistoryRepository: Repository<MarketPriceHistory>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @Inject(forwardRef(() => PriceMovementGateway))
    private priceMovementGateway: PriceMovementGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing price movement service...');
    // Start monitoring price movement changes
    this.startPriceMovementMonitoring();
  }

  onModuleDestroy() {
    if (this.priceMovementCheckInterval) {
      clearInterval(this.priceMovementCheckInterval);
    }
  }

  async getPriceMovement(symbol: string): Promise<PriceMovementDto[]> {
    const query = `
      WITH ranked_prices AS (
        SELECT 
          mph.symbol_id,
          mph.price,
          mph.date,
          ROW_NUMBER() OVER (
            PARTITION BY DATE(mph.date), mph.symbol_id
            ORDER BY mph.date DESC
          ) AS rn
        FROM market_price_history AS mph
        INNER JOIN symbol AS s 
          ON s.symbol_id = mph.symbol_id
        WHERE s.symbol = ?
      )
      SELECT 
        price, 
        date
      FROM ranked_prices
      WHERE rn = 1
      ORDER BY date ASC;
    `;

    this.logger.log(`Fetching latest price movement data per day for symbol: ${symbol}`);
    const results = await this.marketPriceHistoryRepository.query(query, [symbol]);
    
    this.logger.log(`Query returned ${results.length} records for symbol: ${symbol}`);
    
    const priceMovementData = results.map((row) => ({
      price: parseFloat(row.price),
      date: new Date(row.date),
    }));

    // Log sample data for debugging
    if (priceMovementData.length > 0) {
      this.logger.log(`Sample data for ${symbol}: First record - Price: ${priceMovementData[0].price}, Date: ${priceMovementData[0].date}`);
      if (priceMovementData.length > 1) {
        this.logger.log(`Sample data for ${symbol}: Last record - Price: ${priceMovementData[priceMovementData.length - 1].price}, Date: ${priceMovementData[priceMovementData.length - 1].date}`);
      }
    } else {
      this.logger.warn(`No price movement data found for symbol: ${symbol}`);
    }
    
    return priceMovementData;
  }

  private startPriceMovementMonitoring() {
    this.priceMovementCheckInterval = setInterval(async () => {
      try {
        // Get all symbols that have connected clients
        const connectedSymbols = this.priceMovementGateway.getConnectedClientsForSymbol('');
        
        // Get all unique symbols from connected clients
        const symbols = new Set<string>();
        this.priceMovementGateway['connectedClients'].forEach((clientData) => {
          symbols.add(clientData.symbol);
        });

        // Check each symbol for price movement changes
        for (const symbol of symbols) {
          const currentPriceMovement = await this.getPriceMovement(symbol);
          const lastPriceMovement = this.lastPriceMovements.get(symbol);

          // Check if price movement data has changed
          if (this.hasPriceMovementChanged(lastPriceMovement, currentPriceMovement)) {
            this.logger.log(`Price movement changes detected for symbol: ${symbol}`);
            
            // Broadcast update to clients subscribed to this symbol
            this.priceMovementGateway.broadcastPriceMovementUpdate(symbol, currentPriceMovement);
            
            // Update last known price movement data
            this.lastPriceMovements.set(symbol, currentPriceMovement);
          }
        }
      } catch (error) {
        this.logger.error('Error checking price movement changes:', error);
      }
    }, this.CHECK_INTERVAL);

    this.logger.log(`Started price movement monitoring (interval: ${this.CHECK_INTERVAL}ms)`);
  }

  private hasPriceMovementChanged(
    lastData: PriceMovementDto[] | undefined,
    currentData: PriceMovementDto[]
  ): boolean {
    if (!lastData || lastData.length !== currentData.length) {
      return true;
    }

    // Compare each price movement entry
    for (let i = 0; i < currentData.length; i++) {
      const last = lastData[i];
      const current = currentData[i];
      
      if (last.price !== current.price || 
          last.date.getTime() !== current.date.getTime()) {
        return true;
      }
    }

    return false;
  }

  // Method to manually trigger price movement check for a specific symbol
  async checkPriceMovementForSymbol(symbol: string): Promise<void> {
    try {
      const currentPriceMovement = await this.getPriceMovement(symbol);
      const lastPriceMovement = this.lastPriceMovements.get(symbol);

      if (this.hasPriceMovementChanged(lastPriceMovement, currentPriceMovement)) {
        this.logger.log(`Manual price movement check - changes detected for symbol: ${symbol}`);
        
        // Broadcast update to clients subscribed to this symbol
        this.priceMovementGateway.broadcastPriceMovementUpdate(symbol, currentPriceMovement);
        
        // Update last known price movement data
        this.lastPriceMovements.set(symbol, currentPriceMovement);
      }
    } catch (error) {
      this.logger.error(`Error checking price movement for symbol ${symbol}:`, error);
    }
  }
}
