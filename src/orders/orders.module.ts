import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PendingOrdersGateway } from './pending-orders.gateway';
import { OrdersChangesGateway } from './orders-changes.gateway';
import { OrderChangesMonitorService } from './order-changes-monitor.service';
import { Order } from '../entities/order.entity';
import { MobileApiLog } from '../entities/mobile-api-log.entity';
import { McamsWallet } from '../entities/mcams-wallet.entity';
import { BboFinance } from '../entities/bbo-finance.entity';
import { CdsHolding } from '../entities/cds-holding.entity';
import { Symbol } from '../entities/symbol.entity';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Order, MobileApiLog, McamsWallet, BboFinance, CdsHolding, Symbol],
      'cms22',
    ),
    FcmModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PendingOrdersGateway,
    OrdersChangesGateway,
    OrderChangesMonitorService,
  ],
  exports: [OrdersService, PendingOrdersGateway, OrdersChangesGateway],
})
export class OrdersModule {}
