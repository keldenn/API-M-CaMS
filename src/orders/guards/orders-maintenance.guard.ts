import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { assertOrdersAvailable } from '../orders-maintenance';

@Injectable()
export class OrdersMaintenanceGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    assertOrdersAvailable();
    return true;
  }
}
