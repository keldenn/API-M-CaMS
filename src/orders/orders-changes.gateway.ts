import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrdersService } from './orders.service';
import { FcmService } from '../fcm/fcm.service';
import {
  DiscoveredPriceInfo,
  AffectedUser,
  PriceDiscoveredEvent,
  PriceDiscoveryResult,
} from './dto/price-discovery.dto';

interface OrderSnapshot {
  order_id: number;
  cd_code: string;
  symbol_id: number;
  side: string;
  price: string;
  buy_vol: number | null;
  sell_vol: number | null;
  flag_id: string;
  order_entry: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/ordersChanges',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class OrdersChangesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersChangesGateway.name);
  private connectedClients = new Set<string>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL_MS = 5000; // 5 seconds
  private previousOrdersSnapshot = new Map<number, OrderSnapshot>();
  
  // Price Discovery tracking
  private discoveredPrices = new Map<number, DiscoveredPriceInfo>(); // key: symbol_id
  private notificationCooldown = new Map<string, Date>(); // key: cd_code+symbol_id+price
  private readonly NOTIFICATION_COOLDOWN_MS = 300000; // 5 minutes cooldown

  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => FcmService))
    private readonly fcmService: FcmService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🌐 OrdersChanges Gateway initialized');
    this.logger.log('   Namespace: /ordersChanges');
    this.logger.log('   Purpose: Real-time order change detection');
    this.logger.log('   Polling Interval: 5 seconds (when clients connected)');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`📡 Client connected to ordersChanges: ${client.id}`);
    this.connectedClients.add(client.id);

    // Start monitoring if this is the first client
    if (this.connectedClients.size === 1) {
      this.logger.log('🚀 Starting order change monitoring (first client connected)');
      await this.startMonitoring();
    }

    // Send current orders snapshot to new client
    await this.sendInitialSnapshot(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`📡 Client disconnected from ordersChanges: ${client.id}`);
    this.connectedClients.delete(client.id);

    // Stop monitoring if no clients are connected
    if (this.connectedClients.size === 0) {
      this.logger.log('⏸️  Stopping order change monitoring (no clients connected)');
      this.stopMonitoring();
    }
  }

  /**
   * Start monitoring orders table for changes
   */
  private async startMonitoring() {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    // Get initial snapshot
    await this.loadOrdersSnapshot();

    this.monitoringInterval = setInterval(async () => {
      await this.checkForOrderChanges();
    }, this.POLLING_INTERVAL_MS);

    this.logger.log('✅ Order monitoring active');
  }

  /**
   * Stop monitoring orders table
   */
  private stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.previousOrdersSnapshot.clear();
      this.logger.log('⏹️  Order monitoring stopped');
    }
  }

  /**
   * Send initial orders snapshot to newly connected client
   */
  private async sendInitialSnapshot(client: Socket) {
    try {
      const query = `
        SELECT 
          order_id, cd_code, symbol_id, side, price, 
          buy_vol, sell_vol, flag_id, order_entry
        FROM orders
        ORDER BY order_id DESC
        LIMIT 100
      `;
      const orders = await this.cms22DataSource.query(query);

      client.emit('initialSnapshot', {
        success: true,
        count: orders.length,
        orders: orders,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`📤 Sent initial snapshot to ${client.id} (${orders.length} orders)`);
    } catch (error) {
      this.logger.error('Error sending initial snapshot:', error);
      client.emit('error', {
        error: true,
        message: 'Failed to load initial orders snapshot',
      });
    }
  }

  /**
   * Load current orders snapshot
   */
  private async loadOrdersSnapshot() {
    try {
      const query = `
        SELECT 
          order_id, cd_code, symbol_id, side, price, 
          buy_vol, sell_vol, flag_id, order_entry
        FROM orders
      `;
      const orders: OrderSnapshot[] = await this.cms22DataSource.query(query);

      // Store in map for quick lookup
      this.previousOrdersSnapshot.clear();
      orders.forEach((order) => {
        this.previousOrdersSnapshot.set(order.order_id, order);
      });

      this.logger.debug(`📸 Loaded snapshot: ${orders.length} orders`);
    } catch (error) {
      this.logger.error('Error loading orders snapshot:', error);
    }
  }

  /**
   * Check for order changes by comparing current state with previous snapshot
   */
  private async checkForOrderChanges() {
    try {
      // Get current orders
      const query = `
        SELECT 
          order_id, cd_code, symbol_id, side, price, 
          buy_vol, sell_vol, flag_id, order_entry
        FROM orders
      `;
      const currentOrders: OrderSnapshot[] = await this.cms22DataSource.query(query);

      // Create map of current orders
      const currentOrdersMap = new Map<number, OrderSnapshot>();
      currentOrders.forEach((order) => {
        currentOrdersMap.set(order.order_id, order);
      });

      // Detect DELETIONS
      const deletedOrders: OrderSnapshot[] = [];
      this.previousOrdersSnapshot.forEach((prevOrder, orderId) => {
        if (!currentOrdersMap.has(orderId)) {
          deletedOrders.push(prevOrder);
        }
      });

      // Detect INSERTIONS (new orders)
      const createdOrders: OrderSnapshot[] = [];
      currentOrdersMap.forEach((currentOrder, orderId) => {
        if (!this.previousOrdersSnapshot.has(orderId)) {
          createdOrders.push(currentOrder);
        }
      });

      // Detect UPDATES
      const updatedOrders: Array<{ old: OrderSnapshot; new: OrderSnapshot }> = [];
      currentOrdersMap.forEach((currentOrder, orderId) => {
        const prevOrder = this.previousOrdersSnapshot.get(orderId);
        if (prevOrder && this.hasOrderChanged(prevOrder, currentOrder)) {
          updatedOrders.push({ old: prevOrder, new: currentOrder });
        }
      });

      // Emit events if changes detected
      if (deletedOrders.length > 0) {
        this.logger.log(`🗑️  Detected ${deletedOrders.length} deleted order(s)`);
        deletedOrders.forEach((order) => {
          this.broadcastOrderDeleted(order);
        });
      }

      if (createdOrders.length > 0) {
        this.logger.log(`➕ Detected ${createdOrders.length} new order(s)`);
        createdOrders.forEach((order) => {
          this.broadcastOrderCreated(order);
        });
      }

      if (updatedOrders.length > 0) {
        this.logger.log(`🔄 Detected ${updatedOrders.length} updated order(s)`);
        updatedOrders.forEach(({ old: oldOrder, new: newOrder }) => {
          this.broadcastOrderUpdated(oldOrder, newOrder);
        });
      }

      // Update snapshot
      this.previousOrdersSnapshot = currentOrdersMap;

      // Check for price discovery changes for all active symbols
      // This recalculates discovered prices (new orders are now included in the calculation)
      await this.checkPriceDiscoveryChanges();

      // After price discovery is updated, check if any new orders match discovered prices
      // This ensures users get notified when they place an order at an existing discovered price
      if (createdOrders.length > 0) {
        await this.checkNewOrdersForPriceDiscovery(createdOrders);
      }
    } catch (error) {
      this.logger.error('Error checking for order changes:', error);
    }
  }

  /**
   * Check if order has changed
   */
  private hasOrderChanged(
    prevOrder: OrderSnapshot,
    currentOrder: OrderSnapshot,
  ): boolean {
    return (
      prevOrder.price !== currentOrder.price ||
      prevOrder.buy_vol !== currentOrder.buy_vol ||
      prevOrder.sell_vol !== currentOrder.sell_vol ||
      prevOrder.side !== currentOrder.side
    );
  }

  /**
   * Broadcast order deleted event
   */
  private broadcastOrderDeleted(order: OrderSnapshot) {
    const event = {
      type: 'orderDeleted',
      order_id: order.order_id,
      cd_code: order.cd_code,
      symbol_id: order.symbol_id,
      side: order.side,
      price: order.price,
      volume: order.side === 'B' ? order.buy_vol : order.sell_vol,
      flag_id: order.flag_id,
      order_entry: order.order_entry,
      timestamp: new Date().toISOString(),
    };

    this.server.emit('orderDeleted', event);
    this.logger.log(
      `📤 Broadcasted orderDeleted: order_id=${order.order_id}, cd_code=${order.cd_code}`,
    );
  }

  /**
   * Broadcast order created event
   */
  private broadcastOrderCreated(order: OrderSnapshot) {
    const event = {
      type: 'orderCreated',
      order_id: order.order_id,
      cd_code: order.cd_code,
      symbol_id: order.symbol_id,
      side: order.side,
      price: order.price,
      volume: order.side === 'B' ? order.buy_vol : order.sell_vol,
      flag_id: order.flag_id,
      order_entry: order.order_entry,
      timestamp: new Date().toISOString(),
    };

    this.server.emit('orderCreated', event);
    this.logger.log(
      `📤 Broadcasted orderCreated: order_id=${order.order_id}, cd_code=${order.cd_code}`,
    );
  }

  /**
   * Broadcast order updated event
   */
  private broadcastOrderUpdated(
    oldOrder: OrderSnapshot,
    newOrder: OrderSnapshot,
  ) {
    const event = {
      type: 'orderUpdated',
      order_id: newOrder.order_id,
      cd_code: newOrder.cd_code,
      symbol_id: newOrder.symbol_id,
      changes: {
        price: {
          old: oldOrder.price,
          new: newOrder.price,
        },
        volume: {
          old: oldOrder.side === 'B' ? oldOrder.buy_vol : oldOrder.sell_vol,
          new: newOrder.side === 'B' ? newOrder.buy_vol : newOrder.sell_vol,
        },
        side: {
          old: oldOrder.side,
          new: newOrder.side,
        },
      },
      timestamp: new Date().toISOString(),
    };

    this.server.emit('orderUpdated', event);
    this.logger.log(
      `📤 Broadcasted orderUpdated: order_id=${newOrder.order_id}, cd_code=${newOrder.cd_code}`,
    );
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.monitoringInterval !== null;
  }

  // ============================================================================
  // PRICE DISCOVERY METHODS
  // ============================================================================

  /**
   * Check if newly created orders match existing discovered prices
   * This ensures users get notified when they place an order at an existing discovered price
   */
  private async checkNewOrdersForPriceDiscovery(
    newOrders: OrderSnapshot[],
  ): Promise<void> {
    try {
      for (const order of newOrders) {
        const discoveredInfo = this.discoveredPrices.get(order.symbol_id);
        
        if (!discoveredInfo) {
          // No discovered price for this symbol yet
          continue;
        }

        // Check if this order matches the discovered price
        const orderPrice = parseFloat(order.price);
        const discoveredPrice = parseFloat(discoveredInfo.price);
        const orderVolume = order.side === 'B' ? (order.buy_vol || 0) : (order.sell_vol || 0);

        if (orderVolume === 0) {
          continue; // Skip orders with zero volume
        }

        // Check if order matches discovered price using cumulative matching logic:
        // - BUY orders: price >= discovered_price (willing to pay more will match)
        // - SELL orders: price <= discovered_price (willing to sell lower will match)
        const matchesPrice =
          (order.side === 'B' && orderPrice >= discoveredPrice) ||
          (order.side === 'S' && orderPrice <= discoveredPrice);

        if (matchesPrice) {
          this.logger.log(
            `🎯 New order ${order.order_id} (${order.cd_code}) matches existing discovered price ${discoveredInfo.price} for symbol_id ${order.symbol_id}`,
          );

          // Get symbol name
          const symbolName = await this.getSymbolName(order.symbol_id);

          // Create affected user object
          const affectedUser: AffectedUser = {
            cd_code: order.cd_code,
            order_id: order.order_id,
            side: order.side as 'B' | 'S',
            volume: orderVolume,
            price: order.price,
          };

          // Send notification (cooldown check is handled inside sendPriceDiscoveryNotification)
          await this.sendPriceDiscoveryNotification(
            affectedUser,
            discoveredInfo,
            symbolName || `Symbol #${order.symbol_id}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error checking new orders for price discovery:', error);
    }
  }

  /**
   * Check for price discovery changes across all active symbols
   * This runs after every order change check cycle
   */
  private async checkPriceDiscoveryChanges(): Promise<void> {
    try {
      // Get all unique symbol_ids that have orders
      const symbolQuery = `
        SELECT DISTINCT symbol_id 
        FROM orders 
        WHERE (buy_vol > 0 OR sell_vol > 0)
      `;
      const symbols = await this.cms22DataSource.query(symbolQuery);

      for (const { symbol_id } of symbols) {
        await this.processPriceDiscoveryForSymbol(symbol_id);
      }
    } catch (error) {
      this.logger.error('Error checking price discovery changes:', error);
    }
  }

  /**
   * Process price discovery for a specific symbol
   */
  private async processPriceDiscoveryForSymbol(
    symbolId: number,
  ): Promise<void> {
    try {
      // Calculate current discovered price
      const discoveryResult = await this.calculateDiscoveredPrice(symbolId);

      if (!discoveryResult.hasDiscoveredPrice) {
        // No discovered price found, clear if previously existed
        if (this.discoveredPrices.has(symbolId)) {
          this.logger.log(
            `⚠️  No discovered price for symbol_id ${symbolId} (previously had one)`,
          );
          this.discoveredPrices.delete(symbolId);
        }
        return;
      }

      const currentPrice = discoveryResult.discoveredPrice;
      const previousInfo = this.discoveredPrices.get(symbolId);

      // Check if discovered price has changed or is new
      const hasChanged =
        !previousInfo || previousInfo.price !== currentPrice;

      if (hasChanged) {
        this.logger.log(
          `🎯 Price Discovery Change Detected for symbol_id ${symbolId}:`,
        );
        this.logger.log(
          `   Previous: ${previousInfo?.price || 'none'} → Current: ${currentPrice}`,
        );
        this.logger.log(
          `   Max Tradable: ${discoveryResult.maxTradable.toLocaleString()}`,
        );

        // Store new discovered price info
        const discoveredPriceInfo: DiscoveredPriceInfo = {
          symbol_id: symbolId,
          price: currentPrice,
          maxTradable: discoveryResult.maxTradable,
          buyVolume: discoveryResult.buyVolume,
          sellVolume: discoveryResult.sellVolume,
          discoveredAt: new Date(),
        };
        this.discoveredPrices.set(symbolId, discoveredPriceInfo);

        // Identify affected users and send notifications
        await this.notifyAffectedUsers(discoveredPriceInfo);

        // Broadcast price discovered event to all connected clients
        await this.broadcastPriceDiscovered(discoveredPriceInfo);
      }
    } catch (error) {
      this.logger.error(
        `Error processing price discovery for symbol_id ${symbolId}:`,
        error,
      );
    }
  }

  /**
   * Calculate the discovered price for a symbol
   * Uses the same logic as orderbook service: price with max tradable volume
   */
  private async calculateDiscoveredPrice(
    symbolId: number,
  ): Promise<PriceDiscoveryResult> {
    try {
      const query = `
        WITH PriceLevels AS (
          SELECT 
            price,
            SUM(CASE WHEN side = 'B' THEN COALESCE(buy_vol, 0) ELSE 0 END) as total_buy,
            SUM(CASE WHEN side = 'S' THEN COALESCE(sell_vol, 0) ELSE 0 END) as total_sell
          FROM orders
          WHERE symbol_id = ?
          GROUP BY price
        )
        SELECT 
          price,
          total_buy as buy_volume,
          total_sell as sell_volume,
          LEAST(total_buy, total_sell) as max_tradable
        FROM PriceLevels
        WHERE total_buy > 0 AND total_sell > 0
        ORDER BY max_tradable DESC, price DESC
        LIMIT 1
      `;

      const result = await this.cms22DataSource.query(query, [symbolId]);

      if (result.length === 0) {
        return {
          hasDiscoveredPrice: false,
          discoveredPrice: '0',
          maxTradable: 0,
          buyVolume: 0,
          sellVolume: 0,
        };
      }

      const discovered = result[0];
      return {
        hasDiscoveredPrice: true,
        discoveredPrice: discovered.price,
        maxTradable: parseInt(discovered.max_tradable, 10) || 0,
        buyVolume: parseInt(discovered.buy_volume, 10) || 0,
        sellVolume: parseInt(discovered.sell_volume, 10) || 0,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating discovered price for symbol_id ${symbolId}:`,
        error,
      );
      return {
        hasDiscoveredPrice: false,
        discoveredPrice: '0',
        maxTradable: 0,
        buyVolume: 0,
        sellVolume: 0,
      };
    }
  }

  /**
   * Identify users whose orders are at the discovered price and send notifications
   */
  private async notifyAffectedUsers(
    discoveredInfo: DiscoveredPriceInfo,
  ): Promise<void> {
    try {
      const affectedUsers = await this.getAffectedUsers(
        discoveredInfo.symbol_id,
        discoveredInfo.price,
      );

      if (affectedUsers.length === 0) {
        this.logger.warn(
          `No affected users found for symbol_id ${discoveredInfo.symbol_id} at price ${discoveredInfo.price}`,
        );
        return;
      }

      this.logger.log(
        `📤 Sending notifications to ${affectedUsers.length} affected user(s)`,
      );

      // Log aggregated volumes for transparency
      const totalBuyVol = affectedUsers
        .filter((u) => u.side === 'B')
        .reduce((sum, u) => sum + u.volume, 0);
      const totalSellVol = affectedUsers
        .filter((u) => u.side === 'S')
        .reduce((sum, u) => sum + u.volume, 0);
      
      if (totalBuyVol > 0) {
        this.logger.log(`   📊 Total BUY volume notified: ${totalBuyVol.toLocaleString()}`);
      }
      if (totalSellVol > 0) {
        this.logger.log(`   📊 Total SELL volume notified: ${totalSellVol.toLocaleString()}`);
      }

      // Get symbol name for better notification message
      const symbolName = await this.getSymbolName(discoveredInfo.symbol_id);

      // Send notifications to each affected user (with cooldown check)
      const notificationPromises = affectedUsers.map((user) =>
        this.sendPriceDiscoveryNotification(
          user,
          discoveredInfo,
          symbolName || `Symbol #${discoveredInfo.symbol_id}`,
        ),
      );

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      this.logger.error('Error notifying affected users:', error);
    }
  }

  /**
   * Get all users with orders at or better than the discovered price level
   * Uses cumulative matching logic:
   * - SELL orders: price <= discovered_price (sellers willing to sell lower will match)
   * - BUY orders: price >= discovered_price (buyers willing to pay more will match)
   * Aggregates multiple orders from the same user at the same price
   */
  private async getAffectedUsers(
    symbolId: number,
    price: string,
  ): Promise<AffectedUser[]> {
    try {
      // Aggregate orders by cd_code and side to get total volume per user
      // Use cumulative matching: SELL <= price, BUY >= price
      const query = `
        SELECT 
          cd_code,
          side,
          price,
          SUM(CASE 
            WHEN side = 'B' THEN buy_vol 
            ELSE sell_vol 
          END) as total_volume,
          GROUP_CONCAT(order_id) as order_ids
        FROM orders
        WHERE symbol_id = ?
          AND (
            (side = 'B' AND price >= ? AND buy_vol > 0) OR 
            (side = 'S' AND price <= ? AND sell_vol > 0)
          )
        GROUP BY cd_code, side, price
      `;

      const results = await this.cms22DataSource.query(query, [symbolId, price, price]);

      return results.map((row) => ({
        cd_code: row.cd_code,
        order_id: parseInt(row.order_ids.split(',')[0], 10), // Use first order_id for reference
        side: row.side as 'B' | 'S',
        volume: parseInt(row.total_volume, 10) || 0,
        price: row.price,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting affected users for symbol_id ${symbolId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get symbol name from symbol_id
   */
  private async getSymbolName(symbolId: number): Promise<string | null> {
    try {
      const query = `SELECT symbol FROM symbol WHERE symbol_id = ? LIMIT 1`;
      const result = await this.cms22DataSource.query(query, [symbolId]);
      return result.length > 0 ? result[0].symbol : null;
    } catch (error) {
      this.logger.error(`Error getting symbol name for ${symbolId}:`, error);
      return null;
    }
  }

  /**
   * Send FCM notification to a user about price discovery
   */
  private async sendPriceDiscoveryNotification(
    user: AffectedUser,
    discoveredInfo: DiscoveredPriceInfo,
    symbolName: string,
  ): Promise<void> {
    try {
      // Check cooldown to prevent notification spam
      const cooldownKey = `${user.cd_code}_${discoveredInfo.symbol_id}_${discoveredInfo.price}`;
      const lastNotification = this.notificationCooldown.get(cooldownKey);

      if (lastNotification) {
        const timeSinceLastNotification =
          Date.now() - lastNotification.getTime();
        if (timeSinceLastNotification < this.NOTIFICATION_COOLDOWN_MS) {
          this.logger.debug(
            `Skipping notification for ${user.cd_code} (cooldown: ${Math.round(timeSinceLastNotification / 1000)}s ago)`,
          );
          return;
        }
      }

      // Send notification via FCM service
      await this.fcmService.sendPriceDiscoveredNotification(
        user.cd_code,
        {
          symbol_id: discoveredInfo.symbol_id,
          symbol_name: symbolName,
          price: discoveredInfo.price,
          side: user.side,
          volume: user.volume,
          order_id: user.order_id,
          maxTradable: discoveredInfo.maxTradable,
        },
      );

      // Update cooldown timestamp
      this.notificationCooldown.set(cooldownKey, new Date());

      this.logger.log(
        `✅ Sent price discovery notification to cd_code: ${user.cd_code} (${user.side === 'B' ? 'BUY' : 'SELL'} ${user.volume.toLocaleString()} @ ${discoveredInfo.price})`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending notification to ${user.cd_code}:`,
        error,
      );
    }
  }

  /**
   * Broadcast price discovered event to all connected WebSocket clients
   */
  private async broadcastPriceDiscovered(
    discoveredInfo: DiscoveredPriceInfo,
  ): Promise<void> {
    try {
      const symbolName = await this.getSymbolName(discoveredInfo.symbol_id);

      const event: PriceDiscoveredEvent = {
        type: 'priceDiscovered',
        symbol_id: discoveredInfo.symbol_id,
        symbol_name: symbolName || undefined,
        price: discoveredInfo.price,
        maxTradable: discoveredInfo.maxTradable,
        buyVolume: discoveredInfo.buyVolume,
        sellVolume: discoveredInfo.sellVolume,
        affectedUsersCount:
          (await this.getAffectedUsers(discoveredInfo.symbol_id, discoveredInfo.price))
            .length,
        timestamp: new Date().toISOString(),
      };

      this.server.emit('priceDiscovered', event);

      this.logger.log(
        `📡 Broadcasted priceDiscovered event for symbol_id ${discoveredInfo.symbol_id}`,
      );
    } catch (error) {
      this.logger.error('Error broadcasting price discovered event:', error);
    }
  }

  /**
   * Get current discovered prices (for debugging/monitoring)
   */
  getDiscoveredPrices(): Map<number, DiscoveredPriceInfo> {
    return this.discoveredPrices;
  }

  /**
   * Clear notification cooldown cache (useful for testing)
   */
  clearNotificationCooldown(): void {
    this.notificationCooldown.clear();
    this.logger.log('🧹 Cleared notification cooldown cache');
  }
}




