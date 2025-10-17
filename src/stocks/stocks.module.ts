import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { StocksGateway } from './stocks.gateway';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { IndexGateway } from './index.gateway';
import { IndexService } from './index.service';
import { IndexController } from './index.controller';
import { PriceMovementGateway } from './price-movement.gateway';
import { PriceMovementService } from './price-movement.service';
import { PriceMovementController } from './price-movement.controller';
import { MarketPrice } from '../entities/market-price.entity';
import { Symbol } from '../entities/symbol.entity';
import { MarketIndex } from '../entities/market-index.entity';
import { SectorIndex } from '../entities/sector-index.entity';
import { MarketPriceHistory } from '../entities/market-price-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketPrice, Symbol, MarketIndex, SectorIndex, MarketPriceHistory]),
    JwtModule.register({}), // Add JWT module for WebSocket authentication
  ],
  controllers: [StocksController, IndexController, PriceMovementController],
  providers: [StocksGateway, StocksService, IndexGateway, IndexService, PriceMovementGateway, PriceMovementService],
  exports: [StocksService, IndexService, PriceMovementService],
})
export class StocksModule {}

