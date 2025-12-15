import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';
import { MarketDataResponseDto } from './dto/market-data-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Market Data')
@Controller('market-data')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('get-market-data/:ticker')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get market data for a ticker',
    description:
      'Retrieve comprehensive market data including price, volume, financial metrics, and market capitalization for a given stock ticker symbol.',
  })
  @ApiParam({
    name: 'ticker',
    description: 'Stock ticker symbol',
    example: 'BNBL',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Market data retrieved successfully',
    type: MarketDataResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data or ticker is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Symbol not found',
  })
  async getMarketData(
    @Param('ticker') ticker: string,
  ): Promise<MarketDataResponseDto> {
    return this.marketDataService.getMarketData(ticker);
  }
}
