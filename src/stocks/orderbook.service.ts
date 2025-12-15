import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  forwardRef,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderbookLevelDto, OrderbookResponseDto } from './dto/orderbook.dto';
import { OrderbookGateway } from './orderbook.gateway';

@Injectable()
export class OrderbookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderbookService.name);
  private discoveredPrices = new Map<string, string>(); // Store discovered prices per symbol
  private orderbookCheckInterval: NodeJS.Timeout;
  private lastOrderbookData = new Map<string, OrderbookResponseDto>(); // Store last orderbook data per symbol
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
    @Inject(forwardRef(() => OrderbookGateway))
    private orderbookGateway: OrderbookGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing orderbook service...');
    // Start monitoring orderbook changes
    this.startOrderbookMonitoring();
  }

  onModuleDestroy() {
    if (this.orderbookCheckInterval) {
      clearInterval(this.orderbookCheckInterval);
    }
  }

  /**
   * Get orderbook data for a specific symbol
   * This implements the same logic as the PHP code with optimized queries
   */
  async getOrderbook(
    symbol: string,
    includeZeroVolumes = false,
  ): Promise<OrderbookResponseDto> {
    if (!symbol || !symbol.trim()) {
      throw new BadRequestException('Symbol parameter is required');
    }

    const sanitizedSymbol = symbol.trim();

    try {
      // First, check if symbol exists
      const symbolCheckQuery = `SELECT symbol_id, symbol FROM symbol WHERE symbol = ? LIMIT 1`;
      const symbolCheck = await this.cms22DataSource.query(symbolCheckQuery, [
        sanitizedSymbol,
      ]);

      if (symbolCheck.length === 0) {
        this.logger.warn(`Symbol '${sanitizedSymbol}' not found in database`);
        return {
          error: false,
          message: 'Success',
          data: [],
          discoveredPrice: '0',
          timestamp: new Date()
            .toISOString()
            .replace('T', ' ')
            .substring(0, 19),
        };
      }

      this.logger.log(
        `Symbol '${sanitizedSymbol}' found with symbol_id: ${symbolCheck[0].symbol_id}`,
      );

      // Check if orders exist for this symbol
      const ordersCheckQuery = `SELECT COUNT(*) as count FROM orders WHERE symbol_id = ?`;
      const ordersCheck = await this.cms22DataSource.query(ordersCheckQuery, [
        symbolCheck[0].symbol_id,
      ]);
      const orderCount = parseInt(ordersCheck[0].count, 10);

      this.logger.log(
        `Found ${orderCount} orders for symbol '${sanitizedSymbol}'`,
      );

      if (orderCount === 0) {
        this.logger.warn(`No orders found for symbol '${sanitizedSymbol}'`);
        return {
          error: false,
          message: 'Success',
          data: [],
          discoveredPrice: '0',
          timestamp: new Date()
            .toISOString()
            .replace('T', ' ')
            .substring(0, 19),
        };
      }

      // Optimized query with top 5 buy/sell levels and cumulative calculations
      const query = `
        WITH PriceLevels AS (
            SELECT DISTINCT 
                o.symbol_id,
                o.price
            FROM orders o
            INNER JOIN symbol s ON o.symbol_id = s.symbol_id
            WHERE s.symbol = ?
        ),
        -- Cumulative Buy calculation with ranking
        CumulativeBuy AS (
            SELECT 
                pl.symbol_id,
                pl.price,
                COALESCE(SUM(o2.buy_vol), 0) as cumulative_buy,
                ROW_NUMBER() OVER (ORDER BY pl.price DESC) AS buy_rn
            FROM PriceLevels pl
            LEFT JOIN orders o2 ON o2.symbol_id = pl.symbol_id 
                AND o2.price >= pl.price
            GROUP BY pl.symbol_id, pl.price
            HAVING COALESCE(SUM(o2.buy_vol), 0) > 0
        ),
        -- Cumulative Sell calculation with ranking  
        CumulativeSell AS (
            SELECT 
                pl.symbol_id,
                pl.price,
                COALESCE(SUM(o3.sell_vol), 0) as cumulative_sell,
                ROW_NUMBER() OVER (ORDER BY pl.price ASC) AS sell_rn
            FROM PriceLevels pl
            LEFT JOIN orders o3 ON o3.symbol_id = pl.symbol_id 
                AND o3.price <= pl.price
            GROUP BY pl.symbol_id, pl.price
            HAVING COALESCE(SUM(o3.sell_vol), 0) > 0
        ),
        -- Get total buy volume (lowest price's cumulative)
        TotalBuyVol AS (
            SELECT cumulative_buy AS total_buy_vol
            FROM CumulativeBuy
            WHERE price = (SELECT MIN(price) FROM CumulativeBuy WHERE cumulative_buy > 0)
            LIMIT 1
        ),
        -- Get total sell volume (highest price's cumulative)
        TotalSellVol AS (
            SELECT cumulative_sell AS total_sell_vol
            FROM CumulativeSell
            WHERE price = (SELECT MAX(price) FROM CumulativeSell WHERE cumulative_sell > 0)
            LIMIT 1
        ),
        -- Filtered Buy results (top 5 with modified 5th row)
        FilteredBuy AS (
            SELECT 
                cb.symbol_id,
                cb.price,
                CASE 
                    WHEN cb.buy_rn <= 4 THEN cb.cumulative_buy
                    ELSE (SELECT total_buy_vol FROM TotalBuyVol)
                END AS cumulative_buy,
                cb.buy_rn,
                'buy' as side
            FROM CumulativeBuy cb
            WHERE cb.buy_rn <= 5
        ),
        -- Filtered Sell results (top 5 with modified 5th row)
        FilteredSell AS (
            SELECT 
                cs.symbol_id,
                cs.price,
                CASE 
                    WHEN cs.sell_rn <= 4 THEN cs.cumulative_sell
                    ELSE (SELECT total_sell_vol FROM TotalSellVol)
                END AS cumulative_sell,
                cs.sell_rn,
                'sell' as side
            FROM CumulativeSell cs
            WHERE cs.sell_rn <= 5
        )
        -- Main query combining filtered buy and sell using UNION
        SELECT 
            price,
            symbol_id,
            COALESCE(buy_vol, 0) as buy_vol,
            COALESCE(sell_vol, 0) as sell_vol,
            LEAST(
                COALESCE(buy_vol, 0), 
                COALESCE(sell_vol, 0)
            ) as max_tradable
        FROM (
            -- Buy side with NULL sell values
            SELECT 
                fb.price,
                fb.symbol_id,
                fb.cumulative_buy as buy_vol,
                NULL as sell_vol,
                fb.buy_rn as rn,
                fb.side,
                fb.price as sort_price
            FROM FilteredBuy fb
            
            UNION ALL
            
            -- Sell side with NULL buy values
            SELECT 
                fs.price,
                fs.symbol_id,
                NULL as buy_vol,
                fs.cumulative_sell as sell_vol,
                fs.sell_rn as rn,
                fs.side,
                fs.price as sort_price
            FROM FilteredSell fs
        ) combined
        ORDER BY sort_price DESC
      `;

      const priceLevels = await this.cms22DataSource.query(query, [
        sanitizedSymbol,
      ]);

      this.logger.log(
        `Query returned ${priceLevels.length} price levels for symbol '${sanitizedSymbol}'`,
      );

      // Merge rows with the same price (from UNION ALL, we might have duplicate prices)
      // Combine buy_vol and sell_vol for the same price level
      const mergedLevels = new Map<
        string,
        {
          price: string;
          buy_vol: number;
          sell_vol: number;
          max_tradable: number;
        }
      >();

      for (const level of priceLevels) {
        const price = level.price;
        const buyVol = parseInt(level.buy_vol, 10) || 0;
        const sellVol = parseInt(level.sell_vol, 10) || 0;

        if (mergedLevels.has(price)) {
          // Merge: add volumes if price already exists
          const existing = mergedLevels.get(price);
          if (existing) {
            existing.buy_vol += buyVol;
            existing.sell_vol += sellVol;
            existing.max_tradable = Math.min(
              existing.buy_vol,
              existing.sell_vol,
            );
          }
        } else {
          // Create new entry
          mergedLevels.set(price, {
            price: price,
            buy_vol: buyVol,
            sell_vol: sellVol,
            max_tradable: Math.min(buyVol, sellVol),
          });
        }
      }

      // Convert map to array and sort by price descending
      const mergedArray = Array.from(mergedLevels.values()).sort(
        (a, b) => parseFloat(b.price) - parseFloat(a.price),
      );

      // First pass: Find discovered price (only from levels where both volumes > 0)
      let discoveredPrice = '0';
      let maxTradable = 0;

      for (const level of mergedArray) {
        // Only consider levels where both volumes are > 0 for discovered price
        if (level.buy_vol > 0 && level.sell_vol > 0) {
          if (level.max_tradable > maxTradable) {
            maxTradable = level.max_tradable;
            discoveredPrice = level.price;
          }
        }
      }

      // Second pass: Build response data with discovered price
      const responseData: OrderbookLevelDto[] = [];

      for (const level of mergedArray) {
        responseData.push({
          BuyVol: level.buy_vol,
          Price: level.price,
          SellVol: level.sell_vol,
          Discovered: discoveredPrice,
          maxTradable: level.max_tradable,
        });
      }

      // Store discovered price
      this.discoveredPrices.set(sanitizedSymbol, discoveredPrice);

      // Log discovered price calculation
      if (discoveredPrice === '0') {
        this.logger.warn(
          `No discovered price found for symbol '${sanitizedSymbol}' (no price levels with both buy and sell volumes > 0)`,
        );
      } else {
        this.logger.log(
          `Discovered price for '${sanitizedSymbol}': ${discoveredPrice} with max tradable volume: ${maxTradable}`,
        );
      }

      // Prepare success response
      const response: OrderbookResponseDto = {
        error: false,
        message: 'Success',
        data: responseData,
        discoveredPrice: discoveredPrice,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      return response;
    } catch (error) {
      this.logger.error(`Database error for symbol ${sanitizedSymbol}:`, error);
      throw new BadRequestException('Database error occurred');
    }
  }

  /**
   * Get discovered price for a symbol
   */
  getDiscoveredPrice(symbol: string): string {
    return this.discoveredPrices.get(symbol.trim()) || '0';
  }

  /**
   * Store initial orderbook data for a symbol (used when client subscribes)
   */
  storeInitialOrderbookData(symbol: string, data: OrderbookResponseDto) {
    this.lastOrderbookData.set(symbol.trim(), data);
  }

  /**
   * Start monitoring orderbook changes for subscribed symbols
   */
  private startOrderbookMonitoring() {
    this.orderbookCheckInterval = setInterval(async () => {
      try {
        // Get all unique symbols from connected clients
        const symbols = this.orderbookGateway.getConnectedSymbols();

        // Check each symbol for orderbook changes
        for (const symbol of symbols) {
          const currentOrderbook = await this.getOrderbook(symbol);
          const lastOrderbook = this.lastOrderbookData.get(symbol);

          // Check if orderbook data has changed
          if (this.hasOrderbookChanged(lastOrderbook, currentOrderbook)) {
            this.logger.log(`Orderbook changes detected for symbol: ${symbol}`);

            // Broadcast update to clients subscribed to this symbol
            this.orderbookGateway.broadcastOrderbookUpdate(symbol, {
              data: currentOrderbook.data,
              discoveredPrice: currentOrderbook.discoveredPrice,
            });

            // Update last known orderbook data
            this.lastOrderbookData.set(symbol, currentOrderbook);
          }
        }
      } catch (error) {
        this.logger.error('Error checking orderbook changes:', error);
      }
    }, this.CHECK_INTERVAL);

    this.logger.log(
      `Started orderbook monitoring (interval: ${this.CHECK_INTERVAL}ms)`,
    );
  }

  /**
   * Check if orderbook data has changed
   */
  private hasOrderbookChanged(
    lastData: OrderbookResponseDto | undefined,
    currentData: OrderbookResponseDto,
  ): boolean {
    // If no previous data, consider it changed
    if (!lastData) {
      return true;
    }

    // Check if discovered price changed
    if (lastData.discoveredPrice !== currentData.discoveredPrice) {
      return true;
    }

    // Check if number of price levels changed
    if (lastData.data.length !== currentData.data.length) {
      return true;
    }

    // Check if any price level data changed
    for (let i = 0; i < currentData.data.length; i++) {
      const last = lastData.data[i];
      const current = currentData.data[i];

      if (!last) {
        return true; // New price level added
      }

      // Check if price level changed
      if (
        last.Price !== current.Price ||
        last.BuyVol !== current.BuyVol ||
        last.SellVol !== current.SellVol ||
        last.maxTradable !== current.maxTradable ||
        last.Discovered !== current.Discovered
      ) {
        return true;
      }
    }

    return false;
  }
}
