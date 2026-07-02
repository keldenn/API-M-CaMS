import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CdsHolding } from '../entities/cds-holding.entity';
import { SecurityTypeMaster } from '../entities/security-type-master.entity';
import { Symbol } from '../entities/symbol.entity';
import { BondTradingController } from './trading.controller';
import { BondTradingService } from './trading.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityTypeMaster, Symbol, CdsHolding])],
  controllers: [BondTradingController],
  providers: [BondTradingService],
  exports: [BondTradingService],
})
export class BondModule {}
