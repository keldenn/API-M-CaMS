import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { NewOrderDto } from './dto/new-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { DeleteOrderDto } from './dto/delete-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { PendingOrdersResponseDto, PendingOrdersRequestDto } from './dto/pending-orders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderChangesMonitorService, CircuitState } from './order-changes-monitor.service';

@ApiTags('Order')
@Controller('order')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly monitorService: OrderChangesMonitorService,
  ) {}

  @Post('newOrder')
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new buy or sell order. All orders are protected and require JWT authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Order placed successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or business rule violation',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async createOrder(
    @Body() newOrderDto: NewOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.createNewOrder(newOrderDto);
  }

  @Post('updateOrder')
  @ApiOperation({
    summary: 'Update an existing order',
    description:
      'Updates an existing buy or sell order. Updates volume, price, and recalculates commission and amounts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order updated successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or business rule violation',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async updateOrder(
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateOrder(updateOrderDto);
  }

  @Post('deleteOrder')
  @ApiOperation({
    summary: 'Delete an existing order',
    description:
      'Deletes an existing order. For sell orders, updates holdings. Updates audit trail and removes related finance records.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order deleted successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or business rule violation',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async deleteOrder(
    @Body() deleteOrderDto: DeleteOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.deleteOrder(deleteOrderDto);
  }

  @Get('pendingOrders')
  @ApiOperation({
    summary: 'Get pending orders for a username',
    description:
      'Retrieves all pending orders (both buy and sell) for a specific username. Orders are sorted by side (Sell orders first, then Buy orders).',
  })
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'Username to get pending orders for',
    example: 'user123',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending orders retrieved successfully',
    type: PendingOrdersResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - username is required or invalid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async getPendingOrders(
    @Query('username') username: string,
  ): Promise<PendingOrdersResponseDto> {
    return this.ordersService.getPendingOrders(username);
  }

  // ============================================================================
  // MONITORING ENDPOINTS (For FCM & WebSocket Status)
  // ============================================================================

  @Get('monitor/health')
  @ApiOperation({
    summary: 'Get FCM notification monitor health status',
    description:
      'Returns comprehensive health status of the order changes monitoring service including WebSocket connection, FCM circuit breaker state, and notification queue status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean', description: 'WebSocket connection status' },
        socketId: { type: 'string', description: 'Current socket ID' },
        queueSize: { type: 'number', description: 'Number of notifications in queue' },
        circuitState: { type: 'string', description: 'Circuit breaker state (CLOSED/OPEN/HALF_OPEN)' },
        fcmFailureCount: { type: 'number', description: 'Current FCM failure count' },
        fcmSuccessCount: { type: 'number', description: 'Current FCM success count' },
        isProcessingQueue: { type: 'boolean', description: 'Whether queue is being processed' },
        reconnectAttempts: { type: 'number', description: 'Number of reconnection attempts' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  getMonitorHealth(): {
    connected: boolean;
    socketId: string;
    queueSize: number;
    circuitState: string;
    fcmFailureCount: number;
    fcmSuccessCount: number;
    isProcessingQueue: boolean;
    reconnectAttempts: number;
  } {
    return this.monitorService.getHealthStatus();
  }

  @Get('monitor/queue')
  @ApiOperation({
    summary: 'Get notification queue status',
    description:
      'Returns detailed status of the notification queue including size, oldest item timestamp, and processing state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        size: { type: 'number', description: 'Number of notifications in queue' },
        oldestItem: { type: 'string', format: 'date-time', description: 'Timestamp of oldest notification' },
        isProcessing: { type: 'boolean', description: 'Whether queue is being processed' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  getQueueStatus(): {
    size: number;
    oldestItem: Date | null;
    isProcessing: boolean;
  } {
    return this.monitorService.getQueueStatus();
  }

  @Get('monitor/circuit')
  @ApiOperation({
    summary: 'Get FCM circuit breaker status',
    description:
      'Returns status of the FCM circuit breaker including current state, failure/success counts, and last open time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Circuit state (CLOSED/OPEN/HALF_OPEN)' },
        failureCount: { type: 'number', description: 'Current failure count' },
        successCount: { type: 'number', description: 'Current success count (for HALF_OPEN)' },
        lastOpenTime: { type: 'string', format: 'date-time', description: 'Last time circuit was opened' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  getCircuitStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastOpenTime: Date | null;
  } {
    return this.monitorService.getCircuitStatus();
  }

  @Post('monitor/reset-circuit')
  @ApiOperation({
    summary: 'Reset FCM circuit breaker (Admin)',
    description:
      'Manually reset the circuit breaker to CLOSED state. Use this if FCM has recovered but circuit is still open.',
  })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker reset successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        newState: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  resetCircuit(): {
    message: string;
    newState: string;
  } {
    this.monitorService.resetCircuit();
    return {
      message: 'Circuit breaker reset successfully',
      newState: 'CLOSED',
    };
  }

  @Post('monitor/clear-queue')
  @ApiOperation({
    summary: 'Clear notification queue (Admin)',
    description:
      'Remove all pending notifications from the queue. Use with caution - notifications will be lost.',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue cleared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        itemsRemoved: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  clearQueue(): {
    message: string;
    itemsRemoved: number;
  } {
    const itemsRemoved = this.monitorService.clearQueue();
    return {
      message: 'Notification queue cleared',
      itemsRemoved,
    };
  }
}
