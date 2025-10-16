import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StocksGateway } from './stocks.gateway';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { IndexGateway } from './index.gateway';
import { IndexService } from './index.service';
import { IndexController } from './index.controller';
import { MarketPrice } from '../entities/market-price.entity';
import { Symbol } from '../entities/symbol.entity';
import { MarketIndex } from '../entities/market-index.entity';
import { SectorIndex } from '../entities/sector-index.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketPrice, Symbol, MarketIndex, SectorIndex])],
  controllers: [StocksController, IndexController],
  providers: [StocksGateway, StocksService, IndexGateway, IndexService],
  exports: [StocksService, IndexService],
})
export class StocksModule {}

