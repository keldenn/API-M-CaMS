import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PendingOrdersResponseDto } from './dto/pending-orders.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/pendingOrders',
  pingTimeout: 60000, // 60 seconds - time to wait for pong before considering connection dead
  pingInterval: 25000, // 25 seconds - interval to send ping
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class PendingOrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PendingOrdersGateway.name);
  private connectedClients = new Map<
    string,
    { socket: Socket; username: string }
  >();
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 60000; // 60 seconds

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('PendingOrders Gateway initialized');
    this.startAutoRefresh();
  }

  async handleConnection(client: Socket) {
    this.logger.log(`PendingOrders client connected: ${client.id}`);
    
    // Set up connection error handling
    client.on('error', (error) => {
      this.logger.error(`Client ${client.id} error:`, error);
    });

    // Handle client disconnection cleanup
    client.on('disconnecting', (reason) => {
      this.logger.log(`Client ${client.id} disconnecting. Reason: ${reason}`);
    });

    // Set connection timeout to prevent stale connections
    // If client doesn't subscribe within 60 seconds, disconnect
    const connectionTimeout = setTimeout(() => {
      if (!this.connectedClients.has(client.id)) {
        this.logger.warn(
          `Client ${client.id} did not subscribe within timeout period (60s). Disconnecting.`,
        );
        client.disconnect(true);
      }
    }, 60000); // 60 seconds timeout - gives client time to subscribe

    // Store timeout reference for cleanup
    (client as any).connectionTimeout = connectionTimeout;
  }

  handleDisconnect(client: Socket) {
    const reason = (client as any).disconnectReason || 'unknown';
    this.logger.log(
      `PendingOrders client disconnected: ${client.id}. Reason: ${reason}`,
    );
    
    // Clean up connection timeout if exists
    if ((client as any).connectionTimeout) {
      clearTimeout((client as any).connectionTimeout);
    }
    
    // Remove from connected clients
    this.connectedClients.delete(client.id);
    
    // Stop auto-refresh if no clients are connected
    if (this.connectedClients.size === 0 && this.refreshInterval) {
      this.stopAutoRefresh();
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { username: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Validate required parameters
    if (!data.username || !data.username.trim()) {
      client.emit('error', {
        error: true,
        message: 'Username parameter is required',
      });
      return { status: 'error', message: 'Username parameter is required' };
    }

    const username = data.username.trim();
    this.logger.log(
      `Client ${client.id} subscribing to pending orders for username: ${username}`,
    );

    // Clear connection timeout since client has subscribed
    if ((client as any).connectionTimeout) {
      clearTimeout((client as any).connectionTimeout);
      delete (client as any).connectionTimeout;
    }

    // Store client and username mapping
    this.connectedClients.set(client.id, { socket: client, username: username });

    // Start auto-refresh if not already running
    if (!this.refreshInterval) {
      this.startAutoRefresh();
    }

    try {
      // Send initial data
      const pendingOrders = await this.ordersService.getPendingOrders(username);
      client.emit('pendingOrdersData', pendingOrders);

      this.logger.log(
        `Client ${client.id} subscribed to pending orders for username: ${username}. Auto-refresh enabled (60s interval).`,
      );

      return { status: 'subscribed', username: username };
    } catch (error) {
      this.logger.error(
        `Error fetching pending orders for username ${username}:`,
        error,
      );
      client.emit('error', {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : 'Error fetching pending orders data',
      });
      return { status: 'error', message: 'Error fetching pending orders data' };
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from pending orders`);
    this.connectedClients.delete(client.id);
    return { status: 'unsubscribed' };
  }

  @SubscribeMessage('refresh')
  async handleRefresh(
    @MessageBody() data: { username?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientData = this.connectedClients.get(client.id);
    const username = data.username?.trim() || clientData?.username;

    if (!username) {
      client.emit('error', {
        error: true,
        message: 'Username is required for refresh',
      });
      return { status: 'error', message: 'Username is required' };
    }

    try {
      const pendingOrders = await this.ordersService.getPendingOrders(username);
      client.emit('pendingOrdersData', pendingOrders);
      return { status: 'refreshed', username: username };
    } catch (error) {
      this.logger.error(`Error refreshing pending orders for ${username}:`, error);
      client.emit('error', {
        error: true,
        message: 'Error refreshing pending orders',
      });
      return { status: 'error', message: 'Error refreshing pending orders' };
    }
  }

  // Method to broadcast pending orders updates to specific username subscribers
  broadcastPendingOrdersUpdate(username: string, pendingOrders: PendingOrdersResponseDto) {
    const disconnectedClients: string[] = [];
    
    this.connectedClients.forEach((clientData, clientId) => {
      if (clientData.username === username) {
        // Check if socket is still connected before emitting
        if (clientData.socket.connected) {
          try {
            clientData.socket.emit('pendingOrdersUpdate', pendingOrders);
            this.logger.debug(
              `Broadcasted pending orders update for ${username} to client ${clientId}`,
            );
          } catch (error) {
            this.logger.error(
              `Error broadcasting to client ${clientId}:`,
              error,
            );
            disconnectedClients.push(clientId);
          }
        } else {
          // Socket is disconnected, mark for cleanup
          this.logger.warn(
            `Client ${clientId} is disconnected but still in connectedClients map. Removing.`,
          );
          disconnectedClients.push(clientId);
        }
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach((clientId) => {
      this.connectedClients.delete(clientId);
    });

    // Stop auto-refresh if no clients remain
    if (this.connectedClients.size === 0 && this.refreshInterval) {
      this.stopAutoRefresh();
    }
  }

  // Method to get all connected clients for a specific username
  getConnectedClientsForUsername(username: string): string[] {
    const clients: string[] = [];
    this.connectedClients.forEach((clientData, clientId) => {
      if (clientData.username === username) {
        clients.push(clientId);
      }
    });
    return clients;
  }

  /**
   * Start automatic refresh interval (60 seconds)
   */
  private startAutoRefresh() {
    if (this.refreshInterval) {
      return; // Already started
    }

    this.logger.log(`Starting auto-refresh interval (${this.REFRESH_INTERVAL_MS / 1000} seconds)`);
    
    this.refreshInterval = setInterval(async () => {
      await this.refreshAllSubscriptions();
    }, this.REFRESH_INTERVAL_MS);
  }

  /**
   * Stop automatic refresh interval
   */
  private stopAutoRefresh() {
    if (this.refreshInterval) {
      this.logger.log('Stopping auto-refresh interval');
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Refresh all active subscriptions
   */
  private async refreshAllSubscriptions() {
    if (this.connectedClients.size === 0) {
      return; // No clients to refresh
    }

    // Get unique usernames from connected clients
    const uniqueUsernames = new Set<string>();
    this.connectedClients.forEach((clientData) => {
      if (clientData.username) {
        uniqueUsernames.add(clientData.username);
      }
    });

    // Refresh data for each unique username
    for (const username of uniqueUsernames) {
      try {
        const pendingOrders = await this.ordersService.getPendingOrders(username);
        this.broadcastPendingOrdersUpdate(username, pendingOrders);
        this.logger.debug(`Auto-refreshed pending orders for username: ${username}`);
      } catch (error) {
        this.logger.error(
          `Error auto-refreshing pending orders for username ${username}:`,
          error,
        );
        // Emit error to clients subscribed to this username
        this.connectedClients.forEach((clientData, clientId) => {
          if (clientData.username === username) {
            clientData.socket.emit('error', {
              error: true,
              message: 'Error refreshing pending orders data',
            });
          }
        });
      }
    }
  }
}

