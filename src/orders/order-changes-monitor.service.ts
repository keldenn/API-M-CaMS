import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { io, Socket } from 'socket.io-client';
import { FcmService } from '../fcm/fcm.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface OrderChangeEvent {
  type: 'orderDeleted' | 'orderCreated' | 'orderUpdated';
  order_id: number;
  cd_code: string;
  symbol_id: number;
  side: string;
  price: string;
  volume: number;
  flag_id: string;
  order_entry: string;
  timestamp: string;
  changes?: any;
}

@Injectable()
export class OrderChangesMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderChangesMonitorService.name);
  private socket: Socket;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  constructor(
    private readonly configService: ConfigService,
    private readonly fcmService: FcmService,
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('🚀 Order Changes Monitor Service STARTING...');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
    this.logger.log('📡 Connecting as WebSocket CLIENT to /ordersChanges namespace');
    this.logger.log('   Purpose: Monitor real-time order changes');
    this.logger.log('   Action: Send FCM notifications on order changes');
    this.logger.log('');

    // Connect to our own WebSocket gateway as a client
    this.connectToGateway();
  }

  onModuleDestroy() {
    this.logger.log('🛑 Order Changes Monitor Service stopping...');
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  /**
   * Connect to the ordersChanges WebSocket gateway as a client
   */
  private connectToGateway() {
    const port = this.configService.get<number>('PORT') || 3000;
    const serverUrl = `http://localhost:${port}`;
    const namespace = '/ordersChanges';

    this.logger.log(`🔌 Connecting to: ${serverUrl}${namespace}`);

    this.socket = io(`${serverUrl}${namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for WebSocket connection
   */
  private setupEventHandlers() {
    // Connection successful
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('✅ CONNECTED to ordersChanges namespace');
      this.logger.log(`   Socket ID: ${this.socket.id}`);
      this.logger.log('   Status: Monitoring order changes in real-time');
      this.logger.log('   FCM notifications: ENABLED');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('');
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      this.logger.error(
        `❌ Connection error (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}):`,
        error.message,
      );

      if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.logger.error('❌ Max reconnection attempts reached. Stopping reconnection.');
      }
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      this.logger.warn(`⚠️  Disconnected from ordersChanges namespace. Reason: ${reason}`);
      if (reason === 'io server disconnect') {
        // Server disconnected us, reconnect manually
        this.socket.connect();
      }
    });

    // Reconnecting
    this.socket.on('reconnect', (attemptNumber) => {
      this.logger.log(`🔄 Reconnected after ${attemptNumber} attempt(s)`);
    });

    // Order Deleted Event
    this.socket.on('orderDeleted', async (event: OrderChangeEvent) => {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('🗑️  ORDER DELETED EVENT RECEIVED');
      this.logger.log(`   Order ID: ${event.order_id}`);
      this.logger.log(`   CD Code: ${event.cd_code}`);
      this.logger.log(`   Symbol ID: ${event.symbol_id}`);
      this.logger.log(`   Side: ${event.side === 'B' ? 'BUY' : 'SELL'}`);
      this.logger.log(`   Price: ${event.price}`);
      this.logger.log(`   Volume: ${event.volume}`);
      this.logger.log(`   Timestamp: ${event.timestamp}`);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      await this.handleOrderDeleted(event);
    });

    // Order Created Event
    this.socket.on('orderCreated', async (event: OrderChangeEvent) => {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('➕ ORDER CREATED EVENT RECEIVED');
      this.logger.log(`   Order ID: ${event.order_id}`);
      this.logger.log(`   CD Code: ${event.cd_code}`);
      this.logger.log(`   Symbol ID: ${event.symbol_id}`);
      this.logger.log(`   Side: ${event.side === 'B' ? 'BUY' : 'SELL'}`);
      this.logger.log(`   Price: ${event.price}`);
      this.logger.log(`   Volume: ${event.volume}`);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      await this.handleOrderCreated(event);
    });

    // Order Updated Event
    this.socket.on('orderUpdated', async (event: OrderChangeEvent) => {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('🔄 ORDER UPDATED EVENT RECEIVED');
      this.logger.log(`   Order ID: ${event.order_id}`);
      this.logger.log(`   CD Code: ${event.cd_code}`);
      this.logger.log(`   Symbol ID: ${event.symbol_id}`);
      this.logger.log(`   Changes:`, event.changes);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      await this.handleOrderUpdated(event);
    });

    // Initial snapshot
    this.socket.on('initialSnapshot', (data) => {
      this.logger.log(`📸 Received initial snapshot: ${data.count} orders`);
    });

    // Error event
    this.socket.on('error', (error) => {
      this.logger.error('❌ Gateway error:', error);
    });
  }

  /**
   * Handle order deleted event
   */
  private async handleOrderDeleted(event: OrderChangeEvent) {
    try {
      // Get symbol name
      const symbolName = await this.getSymbolName(event.symbol_id);

      // Send FCM notification
      this.logger.log('📲 Sending FCM notification for deleted order...');
      
      await this.fcmService.sendOrderChangeNotification(event.cd_code, {
        order_id: event.order_id,
        symbol: symbolName,
        side: event.side,
        price: event.price,
        volume: event.volume,
        action: 'deleted',
      });

      this.logger.log('✅ FCM notification sent successfully');
      this.logger.log('');
    } catch (error) {
      this.logger.error('❌ Error handling order deleted event:', error);
    }
  }

  /**
   * Handle order created event
   */
  private async handleOrderCreated(event: OrderChangeEvent) {
    try {
      // Get symbol name
      const symbolName = await this.getSymbolName(event.symbol_id);

      // Send FCM notification
      this.logger.log('📲 Sending FCM notification for new order...');
      
      await this.fcmService.sendOrderChangeNotification(event.cd_code, {
        order_id: event.order_id,
        symbol: symbolName,
        side: event.side,
        price: event.price,
        volume: event.volume,
        action: 'created',
      });

      this.logger.log('✅ FCM notification sent successfully');
      this.logger.log('');
    } catch (error) {
      this.logger.error('❌ Error handling order created event:', error);
    }
  }

  /**
   * Handle order updated event
   */
  private async handleOrderUpdated(event: OrderChangeEvent) {
    try {
      // Get symbol name
      const symbolName = await this.getSymbolName(event.symbol_id);

      // Send FCM notification
      this.logger.log('📲 Sending FCM notification for updated order...');
      
      await this.fcmService.sendOrderChangeNotification(event.cd_code, {
        order_id: event.order_id,
        symbol: symbolName,
        side: event.side,
        action: 'updated',
      });

      this.logger.log('✅ FCM notification sent successfully');
      this.logger.log('');
    } catch (error) {
      this.logger.error('❌ Error handling order updated event:', error);
    }
  }

  /**
   * Get symbol name by symbol_id
   */
  private async getSymbolName(symbolId: number): Promise<string> {
    try {
      const query = `SELECT symbol FROM symbol WHERE symbol_id = ? LIMIT 1`;
      const result = await this.cms22DataSource.query(query, [symbolId]);
      return result.length > 0 ? result[0].symbol : `Symbol #${symbolId}`;
    } catch (error) {
      this.logger.warn(`Could not fetch symbol name for symbol_id ${symbolId}`);
      return `Symbol #${symbolId}`;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string {
    return this.socket?.id || 'Not connected';
  }
}




