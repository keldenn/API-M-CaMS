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

@ApiTags('Order')
@Controller('order')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
}
