import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { OrderbookService } from './orderbook.service';
import { OrderbookLevelDto } from './dto/orderbook.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL
  },
  namespace: '/orderbook',
})
export class OrderbookGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrderbookGateway.name);
  private connectedClients = new Map<
    string,
    { socket: Socket; symbol: string }
  >();

  constructor(
    @Inject(forwardRef(() => OrderbookService))
    private readonly orderbookService: OrderbookService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Orderbook client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Orderbook client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { Symbol: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Validate required parameters
    if (!data.Symbol || !data.Symbol.trim()) {
      client.emit('error', {
        error: true,
        message: 'Symbol parameter is required',
      });
      return { status: 'error', message: 'Symbol parameter is required' };
    }

    const symbol = data.Symbol.trim();
    this.logger.log(
      `Client ${client.id} subscribing to orderbook for symbol: ${symbol}`,
    );

    // Store client and symbol mapping
    this.connectedClients.set(client.id, { socket: client, symbol: symbol });

    try {
      // Send initial data
      const orderbookData = await this.orderbookService.getOrderbook(symbol);
      client.emit('orderbookData', orderbookData);

      // Store initial data for change detection
      this.orderbookService.storeInitialOrderbookData(symbol, orderbookData);

      return { status: 'subscribed', symbol: symbol };
    } catch (error) {
      this.logger.error(
        `Error fetching orderbook for symbol ${symbol}:`,
        error,
      );
      client.emit('error', {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : 'Error fetching orderbook data',
      });
      return { status: 'error', message: 'Error fetching orderbook data' };
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from orderbook`);
    this.connectedClients.delete(client.id);
    return { status: 'unsubscribed' };
  }

  // Method to broadcast orderbook updates to specific symbol subscribers
  broadcastOrderbookUpdate(
    symbol: string,
    orderbookData: { data: OrderbookLevelDto[]; discoveredPrice: string },
  ) {
    this.connectedClients.forEach((clientData, clientId) => {
      if (clientData.symbol === symbol) {
        clientData.socket.emit('orderbookUpdate', orderbookData);
        this.logger.log(
          `Broadcasted orderbook update for ${symbol} to client ${clientId}`,
        );
      }
    });
  }

  // Method to get all connected clients for a specific symbol
  getConnectedClientsForSymbol(symbol: string): string[] {
    const clients: string[] = [];
    this.connectedClients.forEach((clientData, clientId) => {
      if (clientData.symbol === symbol) {
        clients.push(clientId);
      }
    });
    return clients;
  }

  // Method to get all unique symbols from connected clients
  getConnectedSymbols(): Set<string> {
    const symbols = new Set<string>();
    this.connectedClients.forEach((clientData) => {
      symbols.add(clientData.symbol);
    });
    return symbols;
  }
}
