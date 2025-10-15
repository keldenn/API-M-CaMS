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
import { StocksService } from './stocks.service';
import { StockPriceDto } from './dto/stock-price.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL
  },
  namespace: '/stocks',
})
export class StocksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(StocksGateway.name);

  constructor(
    @Inject(forwardRef(() => StocksService))
    private readonly stocksService: StocksService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { symbols?: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} subscribing to stock prices`);
    
    // Send initial data
    const stockPrices = await this.stocksService.getAllStockPrices();
    client.emit('stockPrices', stockPrices);
    
    return { status: 'subscribed' };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from stock prices`);
    return { status: 'unsubscribed' };
  }

  // Method to broadcast price updates to all connected clients
  broadcastPriceUpdate(stockPrices: StockPriceDto[]) {
    this.server.emit('priceUpdate', stockPrices);
  }
}

