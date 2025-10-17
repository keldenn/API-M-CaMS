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
import { PriceMovementService } from './price-movement.service';
import { PriceMovementDto } from './dto/price-movement.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL
  },
  namespace: '/price_movement',
})
export class PriceMovementGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PriceMovementGateway.name);
  private connectedClients = new Map<string, { socket: Socket; symbol: string }>();

  constructor(
    @Inject(forwardRef(() => PriceMovementService))
    private readonly priceMovementService: PriceMovementService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Price movement client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Price movement client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { symbol: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.symbol) {
      client.emit('error', { message: 'Symbol is required' });
      return { status: 'error', message: 'Symbol is required' };
    }

    this.logger.log(`Client ${client.id} subscribing to price movement for symbol: ${data.symbol}`);
    
    // Store client and symbol mapping
    this.connectedClients.set(client.id, { socket: client, symbol: data.symbol });
    
    // Send initial data
    const priceMovementData = await this.priceMovementService.getPriceMovement(data.symbol);
    client.emit('priceMovementData', priceMovementData);
    
    return { status: 'subscribed', symbol: data.symbol };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from price movement`);
    this.connectedClients.delete(client.id);
    return { status: 'unsubscribed' };
  }

  // Method to broadcast price movement updates to specific symbol subscribers
  broadcastPriceMovementUpdate(symbol: string, priceMovementData: PriceMovementDto[]) {
    this.connectedClients.forEach((clientData, clientId) => {
      if (clientData.symbol === symbol) {
        clientData.socket.emit('priceMovementUpdate', priceMovementData);
        this.logger.log(`Broadcasted price movement update for ${symbol} to client ${clientId}`);
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
}
