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
import { L5PriceService } from './l5price.service';
import { L5PriceDto } from './dto/l5price.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL
  },
  namespace: '/L5price',
})
export class L5PriceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(L5PriceGateway.name);
  private connectedClients = new Map<string, Socket>();

  constructor(
    @Inject(forwardRef(() => L5PriceService))
    private readonly l5PriceService: L5PriceService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`L5price client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`L5price client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} subscribing to L5price data`);

    try {
      // Send initial data
      const l5PriceData = await this.l5PriceService.getL5PriceData();
      client.emit('l5PriceData', l5PriceData);

      return { status: 'subscribed' };
    } catch (error) {
      this.logger.error('Error fetching L5price data:', error);
      client.emit('error', { message: 'Failed to fetch L5price data' });
      return { status: 'error', message: 'Failed to fetch L5price data' };
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from L5price data`);
    return { status: 'unsubscribed' };
  }

  // Method to broadcast L5price updates to all connected clients
  broadcastL5PriceUpdate(l5PriceData: L5PriceDto[]) {
    this.server.emit('l5PriceUpdate', l5PriceData);
  }

  // Method to get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
