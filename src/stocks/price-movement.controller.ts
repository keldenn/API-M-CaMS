import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PriceMovementService } from './price-movement.service';
import { PriceMovementDto } from './dto/price-movement.dto';

@ApiTags('Price Movement')
@Controller('stocks')
export class PriceMovementController {
  constructor(private readonly priceMovementService: PriceMovementService) {}

  @Get('fetch-price-movement/:symbol')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get price movement data for a specific symbol',
    description:
      'Retrieves historical price movement data for the specified stock symbol. Requires JWT authentication.',
  })
  @ApiParam({
    name: 'symbol',
    description: 'Stock symbol (e.g., AAPL, GOOGL)',
    example: 'AAPL',
  })
  @ApiResponse({
    status: 200,
    description: 'Price movement data retrieved successfully',
    type: [PriceMovementDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Symbol parameter is required',
  })
  async getPriceMovement(
    @Param('symbol') symbol: string,
    @Request() req: any,
  ): Promise<PriceMovementDto[]> {
    // The JwtAuthGuard ensures the user is authenticated
    // req.user contains the decoded JWT payload

    if (!symbol) {
      throw new Error('Symbol parameter is required');
    }

    return await this.priceMovementService.getPriceMovement(symbol);
  }
}
