import { BadRequestException } from '@nestjs/common';

/** Asia/Thimphu (UTC+6), aligned with DB_TIMEZONE. */
const RIGHTS_SUBSCRIPTION_TIMEZONE_OFFSET = '+06:00';

export const RIGHTS_SUBSCRIPTION_START = new Date(
  `2026-07-05T17:00:00${RIGHTS_SUBSCRIPTION_TIMEZONE_OFFSET}`,
);

export const RIGHTS_SUBSCRIPTION_END = new Date(
  `2026-07-28T17:00:00${RIGHTS_SUBSCRIPTION_TIMEZONE_OFFSET}`,
);

export function assertRightsSubscriptionWindow(now: Date = new Date()): void {
  if (now < RIGHTS_SUBSCRIPTION_START) {
    throw new BadRequestException('Subscription not yet started');
  }

  if (now >= RIGHTS_SUBSCRIPTION_END) {
    throw new BadRequestException('Subscription has ended');
  }
}
