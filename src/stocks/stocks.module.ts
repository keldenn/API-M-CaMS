import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StocksGateway } from './stocks.gateway';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { MarketPrice } from '../entities/market-price.entity';
import { Symbol } from '../entities/symbol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketPrice, Symbol])],
  controllers: [StocksController],
  providers: [StocksGateway, StocksService],
  exports: [StocksService],
})
export class StocksModule {}

