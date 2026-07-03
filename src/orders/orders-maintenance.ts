import { HttpException, HttpStatus } from '@nestjs/common';

export const ORDERS_MAINTENANCE_MESSAGE =
  'Market Closed.';

export function isOrdersMaintenanceMode(): boolean {
  return process.env.ORDERS_MAINTENANCE_MODE === '1';
}

export function assertOrdersAvailable(): void {
  if (isOrdersMaintenanceMode()) {
    throw new HttpException(
      ORDERS_MAINTENANCE_MESSAGE,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
