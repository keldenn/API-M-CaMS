import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CdsHolding } from '../entities/cds-holding.entity';
import { SecurityTypeMaster } from '../entities/security-type-master.entity';
import { Symbol } from '../entities/symbol.entity';
import { FcmModule } from '../fcm/fcm.module';
import { BondTradingController } from './trading.controller';
import { BondMatchingService } from './bond-matching.service';
import { BondTradingService } from './trading.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityTypeMaster, Symbol, CdsHolding]),
    FcmModule,
  ],
  controllers: [BondTradingController],
  providers: [BondTradingService, BondMatchingService],
  exports: [BondTradingService, BondMatchingService],
})
export class BondModule {}
