import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AccountExpiryFcmService } from './account-expiry-fcm.service';

/**
 * Runs once per day at 06:00 server local time (`0 6 * * *`).
 * Set `ACCOUNT_EXPIRY_FCM_DISABLED=1` to skip the job in an environment.
 */
@Injectable()
export class AccountExpiryFcmScheduler {
  private readonly logger = new Logger(AccountExpiryFcmScheduler.name);

  constructor(
    private readonly accountExpiryFcmService: AccountExpiryFcmService,
  ) {}

  @Cron('0 6 * * *')
  async handleCron(): Promise<void> {
    if (process.env.ACCOUNT_EXPIRY_FCM_DISABLED === '1') {
      this.logger.verbose('Account expiry FCM job disabled via env');
      return;
    }
    this.logger.log('Account expiry FCM scheduled job starting');
    await this.accountExpiryFcmService.runDailyNotifications();
  }
}
