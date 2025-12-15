import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';
import { CdsHolding } from '../entities/cds-holding.entity';
import { Symbol } from '../entities/symbol.entity';
import { BboFinance } from '../entities/bbo-finance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CdsHolding, Symbol, BboFinance])],
  controllers: [HoldingsController],
  providers: [HoldingsService],
  exports: [HoldingsService],
})
export class HoldingsModule {}
