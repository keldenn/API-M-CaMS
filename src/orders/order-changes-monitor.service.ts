import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { io, Socket } from 'socket.io-client';
import { FcmService } from '../fcm/fcm.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface OrderChangeEvent {
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

export interface QueuedNotification {
  event: OrderChangeEvent;
  retryCount: number;
  addedAt: Date;
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // FCM is down, skip calls
  HALF_OPEN = 'HALF_OPEN' // Testing if FCM recovered
}

@Injectable()
export class OrderChangesMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderChangesMonitorService.name);
  private socket: Socket;
  private reconnectAttempts = 0;
  
  // Notification queue for rate limiting
  private notificationQueue: QueuedNotification[] = [];
  private isProcessingQueue = false;
  private queueProcessorInterval: NodeJS.Timeout | null = null;
  
  // Circuit breaker for FCM
  private circuitState: CircuitState = CircuitState.CLOSED;
  private fcmFailureCount = 0;
  private fcmSuccessCount = 0;
  private lastCircuitOpenTime: Date | null = null;
  
  // Configuration constants
  private readonly FCM_TIMEOUT_MS = 10000; // 10 seconds timeout for FCM calls
  private readonly QUEUE_BATCH_SIZE = 10; // Process 10 notifications at a time
  private readonly QUEUE_PROCESS_INTERVAL_MS = 1000; // Process queue every 1 second
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
  private readonly CIRCUIT_SUCCESS_THRESHOLD = 3; // Close circuit after 3 successes
  private readonly CIRCUIT_OPEN_DURATION_MS = 60000; // Keep circuit open for 1 minute
  private readonly MAX_QUEUE_SIZE = 1000; // Maximum notifications in queue
  private readonly RECONNECT_BASE_DELAY_MS = 1000; // Base delay for exponential backoff

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
    this.logger.log('⚙️  Production Features:');
    this.logger.log(`   ✓ FCM Timeout: ${this.FCM_TIMEOUT_MS}ms`);
    this.logger.log(`   ✓ Rate Limiting: ${this.QUEUE_BATCH_SIZE} notifications/batch`);
    this.logger.log(`   ✓ Circuit Breaker: ${this.CIRCUIT_FAILURE_THRESHOLD} failures threshold`);
    this.logger.log(`   ✓ Max Queue Size: ${this.MAX_QUEUE_SIZE} notifications`);
    this.logger.log(`   ✓ Infinite Reconnection: Enabled (exponential backoff)`);
    this.logger.log('');

    // Start notification queue processor
    this.startQueueProcessor();

    // Wait a bit for WebSocket gateway to be fully initialized
    // This prevents race condition where gateway isn't ready yet
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.logger.log('⏳ Waited 2 seconds for WebSocket gateway initialization...');

    // Connect to our own WebSocket gateway as a client
    this.connectToGateway();
  }

  onModuleDestroy() {
    this.logger.log('🛑 Order Changes Monitor Service stopping...');
    
    // Stop queue processor
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Log queue status
    if (this.notificationQueue.length > 0) {
      this.logger.warn(`⚠️  ${this.notificationQueue.length} notifications still in queue`);
    }
  }

  /**
   * Connect to the ordersChanges WebSocket gateway as a client
   */
  private connectToGateway() {
    // Use WEBSOCKET_HOST from environment, fallback to localhost
    const websocketHost = this.configService.get<string>('WEBSOCKET_HOST');
    const port = this.configService.get<number>('PORT') || 3000;
    
    let serverUrl: string;
    if (websocketHost) {
      // If WEBSOCKET_HOST includes port, use as-is, otherwise use http://
      serverUrl = websocketHost.includes('://') 
        ? websocketHost 
        : (websocketHost.includes(':') 
          ? `http://${websocketHost}` 
          : `http://${websocketHost}:${port}`);
    } else {
      // Fallback to localhost
      serverUrl = `http://localhost:${port}`;
    }
    
    const namespace = '/ordersChanges';

    this.logger.log(`🔌 Connecting to: ${serverUrl}${namespace}`);

    this.socket = io(`${serverUrl}${namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.RECONNECT_BASE_DELAY_MS,
      reconnectionDelayMax: 30000, // Max 30 seconds between reconnection attempts
      reconnectionAttempts: Infinity, // Infinite reconnection attempts
      timeout: 30000, // Connection timeout (increased for slower startup)
      forceNew: false,
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
      this.logger.log(`   FCM Circuit State: ${this.circuitState}`);
      this.logger.log(`   Queue Size: ${this.notificationQueue.length}`);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('');
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
        30000
      );
      this.logger.error(
        `❌ Connection error (attempt ${this.reconnectAttempts}, next retry in ${delay}ms):`,
        error.message,
      );
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      this.logger.warn(`⚠️  Disconnected from ordersChanges namespace. Reason: ${reason}`);
      if (reason === 'io server disconnect') {
        // Server disconnected us, reconnect manually
        this.logger.log('🔄 Attempting manual reconnection...');
        this.socket.connect();
      }
    });

    // Reconnecting
    this.socket.on('reconnect', (attemptNumber) => {
      this.logger.log(`🔄 Reconnected successfully after ${attemptNumber} attempt(s)`);
      this.reconnectAttempts = 0;
    });

    // Reconnect attempt
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      if (attemptNumber % 10 === 0) {
        // Log every 10 attempts to avoid spam
        this.logger.log(`🔄 Still trying to reconnect... (attempt ${attemptNumber})`);
      }
    });

    // Reconnect failed
    this.socket.on('reconnect_failed', () => {
      this.logger.error('❌ All reconnection attempts exhausted (should not happen with Infinity)');
    });

    // Order Deleted Event
    this.socket.on('orderDeleted', (event: OrderChangeEvent) => {
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

      this.enqueueNotification(event);
    });

    // Order Created Event
    this.socket.on('orderCreated', (event: OrderChangeEvent) => {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('➕ ORDER CREATED EVENT RECEIVED');
      this.logger.log(`   Order ID: ${event.order_id}`);
      this.logger.log(`   CD Code: ${event.cd_code}`);
      this.logger.log(`   Symbol ID: ${event.symbol_id}`);
      this.logger.log(`   Side: ${event.side === 'B' ? 'BUY' : 'SELL'}`);
      this.logger.log(`   Price: ${event.price}`);
      this.logger.log(`   Volume: ${event.volume}`);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      this.enqueueNotification(event);
    });

    // Order Updated Event
    this.socket.on('orderUpdated', (event: OrderChangeEvent) => {
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('🔄 ORDER UPDATED EVENT RECEIVED');
      this.logger.log(`   Order ID: ${event.order_id}`);
      this.logger.log(`   CD Code: ${event.cd_code}`);
      this.logger.log(`   Symbol ID: ${event.symbol_id}`);
      this.logger.log(`   Changes:`, event.changes);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      this.enqueueNotification(event);
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

  // ============================================================================
  // NOTIFICATION QUEUE & RATE LIMITING
  // ============================================================================

  /**
   * Enqueue notification for processing (rate limiting)
   */
  private enqueueNotification(event: OrderChangeEvent): void {
    // Check queue size limit
    if (this.notificationQueue.length >= this.MAX_QUEUE_SIZE) {
      this.logger.warn(
        `⚠️  Queue is full (${this.MAX_QUEUE_SIZE}), dropping oldest notification`,
      );
      this.notificationQueue.shift(); // Remove oldest
    }

    this.notificationQueue.push({
      event,
      retryCount: 0,
      addedAt: new Date(),
    });

    this.logger.debug(
      `📥 Queued notification (Queue size: ${this.notificationQueue.length})`,
    );
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    this.queueProcessorInterval = setInterval(() => {
      this.processQueue();
    }, this.QUEUE_PROCESS_INTERVAL_MS);

    this.logger.log('✅ Notification queue processor started');
  }

  /**
   * Process notifications from the queue (batch processing)
   */
  private async processQueue(): Promise<void> {
    // Skip if already processing or queue is empty
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    // Check circuit breaker state
    if (this.circuitState === CircuitState.OPEN) {
      this.checkCircuitRecovery();
      if (this.circuitState === CircuitState.OPEN) {
        // Still open, skip processing
        if (this.notificationQueue.length > 0) {
          this.logger.warn(
            `⚠️  Circuit OPEN - skipping ${this.notificationQueue.length} queued notifications`,
          );
        }
        return;
      }
    }

    this.isProcessingQueue = true;

    try {
      // Take batch from queue
      const batch = this.notificationQueue.splice(0, this.QUEUE_BATCH_SIZE);

      if (batch.length > 0) {
        this.logger.debug(
          `📤 Processing ${batch.length} notification(s) from queue (${this.notificationQueue.length} remaining)`,
        );
      }

      // Process each notification in the batch
      const promises = batch.map((queued) =>
        this.processNotification(queued),
      );

      await Promise.allSettled(promises);
    } catch (error) {
      this.logger.error('❌ Error processing queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process a single notification with timeout and circuit breaker
   */
  private async processNotification(
    queued: QueuedNotification,
  ): Promise<void> {
    const event = queued.event;

    try {
      // Get symbol name
      const symbolName = await this.getSymbolName(event.symbol_id);

      // Determine action type
      let action: 'created' | 'updated' | 'deleted';
      if (event.type === 'orderDeleted') {
        action = 'deleted';
      } else if (event.type === 'orderCreated') {
        action = 'created';
      } else {
        action = 'updated';
      }

      // Send FCM notification with timeout
      await this.sendFcmWithTimeout(event.cd_code, {
        order_id: event.order_id,
        symbol: symbolName,
        side: event.side,
        price: event.price,
        volume: event.volume,
        action,
      });

      // Success - update circuit breaker
      this.recordFcmSuccess();

      this.logger.log(
        `✅ FCM notification sent successfully for order ${event.order_id}`,
      );
    } catch (error) {
      // Failure - update circuit breaker
      this.recordFcmFailure();

      this.logger.error(
        `❌ Failed to send FCM notification for order ${event.order_id}:`,
        error.message,
      );

      // Retry logic (limited retries)
      if (queued.retryCount < 2) {
        queued.retryCount++;
        this.notificationQueue.push(queued); // Re-queue for retry
        this.logger.warn(
          `🔄 Re-queuing notification (retry ${queued.retryCount}/2)`,
        );
      } else {
        this.logger.error(
          `❌ Max retries reached for order ${event.order_id}, dropping notification`,
        );
      }
    }
  }

  /**
   * Send FCM notification with timeout protection
   */
  private async sendFcmWithTimeout(
    cdCode: string,
    orderData: {
      order_id: string | number;
      symbol?: string;
      side?: string;
      price?: string | number;
      volume?: string | number;
      action: 'created' | 'updated' | 'deleted';
    },
  ): Promise<void> {
    return Promise.race([
      this.fcmService.sendOrderChangeNotification(cdCode, orderData),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error('FCM timeout')),
          this.FCM_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  // ============================================================================
  // CIRCUIT BREAKER PATTERN
  // ============================================================================

  /**
   * Record FCM success for circuit breaker
   */
  private recordFcmSuccess(): void {
    this.fcmSuccessCount++;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      if (this.fcmSuccessCount >= this.CIRCUIT_SUCCESS_THRESHOLD) {
        this.closeCircuit();
      }
    }
  }

  /**
   * Record FCM failure for circuit breaker
   */
  private recordFcmFailure(): void {
    this.fcmFailureCount++;

    if (this.circuitState === CircuitState.CLOSED) {
      if (this.fcmFailureCount >= this.CIRCUIT_FAILURE_THRESHOLD) {
        this.openCircuit();
      }
    } else if (this.circuitState === CircuitState.HALF_OPEN) {
      // If failed in HALF_OPEN, go back to OPEN
      this.openCircuit();
    }
  }

  /**
   * Open the circuit (stop sending FCM)
   */
  private openCircuit(): void {
    this.circuitState = CircuitState.OPEN;
    this.lastCircuitOpenTime = new Date();
    this.logger.error(
      `🔴 Circuit OPENED - FCM appears to be down (${this.fcmFailureCount} failures)`,
    );
    this.logger.warn(
      `⏸️  Will retry in ${this.CIRCUIT_OPEN_DURATION_MS / 1000} seconds`,
    );
  }

  /**
   * Close the circuit (resume normal operation)
   */
  private closeCircuit(): void {
    this.circuitState = CircuitState.CLOSED;
    this.fcmFailureCount = 0;
    this.fcmSuccessCount = 0;
    this.lastCircuitOpenTime = null;
    this.logger.log('🟢 Circuit CLOSED - FCM is healthy, resuming normal operation');
  }

  /**
   * Check if circuit can transition from OPEN to HALF_OPEN
   */
  private checkCircuitRecovery(): void {
    if (this.circuitState !== CircuitState.OPEN || !this.lastCircuitOpenTime) {
      return;
    }

    const timeSinceOpen = Date.now() - this.lastCircuitOpenTime.getTime();

    if (timeSinceOpen >= this.CIRCUIT_OPEN_DURATION_MS) {
      this.circuitState = CircuitState.HALF_OPEN;
      this.fcmSuccessCount = 0;
      this.fcmFailureCount = 0;
      this.logger.log(
        '🟡 Circuit HALF_OPEN - Testing if FCM has recovered',
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

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

  // ============================================================================
  // MONITORING & STATUS METHODS
  // ============================================================================

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

  /**
   * Get service health status
   */
  getHealthStatus(): {
    connected: boolean;
    socketId: string;
    queueSize: number;
    circuitState: string;
    fcmFailureCount: number;
    fcmSuccessCount: number;
    isProcessingQueue: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      socketId: this.getSocketId(),
      queueSize: this.notificationQueue.length,
      circuitState: this.circuitState,
      fcmFailureCount: this.fcmFailureCount,
      fcmSuccessCount: this.fcmSuccessCount,
      isProcessingQueue: this.isProcessingQueue,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    size: number;
    oldestItem: Date | null;
    isProcessing: boolean;
  } {
    return {
      size: this.notificationQueue.length,
      oldestItem: this.notificationQueue.length > 0 
        ? this.notificationQueue[0].addedAt 
        : null,
      isProcessing: this.isProcessingQueue,
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastOpenTime: Date | null;
  } {
    return {
      state: this.circuitState,
      failureCount: this.fcmFailureCount,
      successCount: this.fcmSuccessCount,
      lastOpenTime: this.lastCircuitOpenTime,
    };
  }

  /**
   * Manually reset circuit breaker (for admin use)
   */
  resetCircuit(): void {
    this.closeCircuit();
    this.logger.log('🔧 Circuit breaker manually reset by admin');
  }

  /**
   * Clear notification queue (for admin use)
   */
  clearQueue(): number {
    const count = this.notificationQueue.length;
    this.notificationQueue = [];
    this.logger.warn(`🧹 Notification queue cleared by admin (${count} items removed)`);
    return count;
  }
}




