import { Controller, Get } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { StockPriceDto } from './dto/stock-price.dto';

@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get('price')
  async getStockPrices(): Promise<StockPriceDto[]> {
    return await this.stocksService.getAllStockPrices();
  }
}

