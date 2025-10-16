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
import { IndexService } from './index.service';
import { IndexDataDto } from './dto/index-data.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL
  },
  namespace: '/index',
})
export class IndexGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(IndexGateway.name);

  constructor(
    @Inject(forwardRef(() => IndexService))
    private readonly indexService: IndexService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Index client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Index client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { sectors?: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Index client ${client.id} subscribing to index data`);
    
    // Send initial data
    const indexData = await this.indexService.getAllIndexData();
    client.emit('indexData', indexData);
    
    return { status: 'subscribed' };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Index client ${client.id} unsubscribing from index data`);
    return { status: 'unsubscribed' };
  }

  // Method to broadcast index updates to all connected clients
  broadcastIndexUpdate(indexData: IndexDataDto[]) {
    this.server.emit('indexUpdate', indexData);
  }
}
