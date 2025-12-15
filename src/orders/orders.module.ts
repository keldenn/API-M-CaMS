import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PendingOrdersGateway } from './pending-orders.gateway';
import { Order } from '../entities/order.entity';
import { MobileApiLog } from '../entities/mobile-api-log.entity';
import { McamsWallet } from '../entities/mcams-wallet.entity';
import { BboFinance } from '../entities/bbo-finance.entity';
import { CdsHolding } from '../entities/cds-holding.entity';
import { Symbol } from '../entities/symbol.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Order, MobileApiLog, McamsWallet, BboFinance, CdsHolding, Symbol],
      'cms22',
    ),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PendingOrdersGateway],
  exports: [OrdersService, PendingOrdersGateway],
})
export class OrdersModule {}
