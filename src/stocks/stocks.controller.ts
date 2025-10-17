import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StocksService } from './stocks.service';
import { StockPriceDto } from './dto/stock-price.dto';
import { MarketStatsDto } from './dto/market-stats.dto';

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get('price')
  @ApiOperation({ 
    summary: 'Get stock prices',
    description: 'Retrieves current stock prices for all active stocks. No authentication required.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Stock prices retrieved successfully',
    type: [StockPriceDto]
  })
  async getStockPrices(): Promise<StockPriceDto[]> {
    return await this.stocksService.getAllStockPrices();
  }

  @Get('market-stats')
  @ApiOperation({ 
    summary: 'Get market statistics',
    description: 'Retrieves current market capitalization and total number of listed scripts. No authentication required.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Market statistics retrieved successfully',
    type: MarketStatsDto
  })
  async getMarketStats(): Promise<MarketStatsDto> {
    return await this.stocksService.getMarketStats();
  }
}

