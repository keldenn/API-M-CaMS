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

  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
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
}




