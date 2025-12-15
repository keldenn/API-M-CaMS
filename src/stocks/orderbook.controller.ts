import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrderbookService } from './orderbook.service';
import { OrderbookRequestDto, OrderbookResponseDto } from './dto/orderbook.dto';

@ApiTags('Company')
@Controller('orderbook')
export class OrderbookController {
  private readonly logger = new Logger(OrderbookController.name);

  constructor(private readonly orderbookService: OrderbookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get orderbook data for a symbol',
    description:
      'Retrieves orderbook data (buy/sell volumes at different price levels) for a specific symbol. Requires symbol parameter only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Orderbook data retrieved successfully',
    type: OrderbookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input or missing required parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getOrderbook(
    @Body() requestDto: OrderbookRequestDto,
  ): Promise<OrderbookResponseDto> {
    this.logger.log(
      `Fetching orderbook data via REST API for symbol: ${requestDto.Symbol}`,
    );

    // Validate symbol
    if (!requestDto.Symbol || !requestDto.Symbol.trim()) {
      throw new BadRequestException('Symbol parameter is required');
    }

    try {
      const orderbookData = await this.orderbookService.getOrderbook(
        requestDto.Symbol,
        false, // includeZeroVolumes defaults to false
      );

      return orderbookData;
    } catch (error) {
      this.logger.error(
        `Error fetching orderbook for symbol ${requestDto.Symbol}:`,
        error,
      );
      throw error;
    }
  }
}
