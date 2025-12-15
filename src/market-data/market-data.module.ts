import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { Symbol } from '../entities/symbol.entity';
import { MarketPriceHistory } from '../entities/market-price-history.entity';
import { ExecutedOrders } from '../entities/executed-orders.entity';
import { EquityMetrics } from '../entities/equity-metrics.entity';
import { Scripts } from '../entities/scripts.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Symbol, MarketPriceHistory, ExecutedOrders],
      'default',
    ),
    TypeOrmModule.forFeature([EquityMetrics, Scripts], 'financial'),
  ],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
