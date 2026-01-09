import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { Symbol } from '../entities/symbol.entity';
import { MarketPriceHistory } from '../entities/market-price-history.entity';
import { ExecutedOrders } from '../entities/executed-orders.entity';
import { EquityMetrics } from '../entities/equity-metrics.entity';
import { Scripts } from '../entities/scripts.entity';

@Module({
  imports: [
    // Use 'cms22' connection for mysql2 database tables
    TypeOrmModule.forFeature(
      [Symbol, MarketPriceHistory, ExecutedOrders],
      'cms22',
    ),
    // Use 'financial' connection for officesite (mysql) database tables
    TypeOrmModule.forFeature([EquityMetrics, Scripts], 'financial'),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}

