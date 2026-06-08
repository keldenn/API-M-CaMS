import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { FcmToken } from '../entities/fcm-token.entity';
import { FcmService } from '../fcm/fcm.service';

/** Same calendar-date logic as login `expired_at` (created_at + 1 year, dd/MM/yyyy display). */
function addOneYear(createdAt: Date): Date {
  const d = new Date(createdAt);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

function formatDdMmYyyy(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

@Injectable()
export class AccountExpiryFcmService {
  private readonly logger = new Logger(AccountExpiryFcmService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(FcmToken, 'cms22')
    private readonly fcmTokenRepository: Repository<FcmToken>,
    private readonly fcmService: FcmService,
  ) {}

  /**
   * Distinct cd_codes that have at least one FCM token (cms22).
   */
  async getCdCodesWithFcmTokens(): Promise<string[]> {
    const rows = await this.fcmTokenRepository
      .createQueryBuilder('f')
      .select('f.cd_code', 'cd_code')
      .distinct(true)
      .where('f.cd_code IS NOT NULL')
      .andWhere("TRIM(f.cd_code) != ''")
      .getRawMany<{ cd_code: string }>();
    return rows.map((r) => r.cd_code.trim()).filter(Boolean);
  }

  /**
   * User subscription fields for cd_code (default DB), same join as login.
   * NRB accounts (isNRB = 'Y') do not expire — caller should skip notifications.
   */
  async getUserSubscriptionInfoByCdCode(cdCode: string): Promise<{
    createdAt: Date;
    isNrb: string;
  } | null> {
    const query = `
      SELECT u.created_at AS created_at, u.isNRB AS isNRB
      FROM users u
      INNER JOIN linkuser l ON l.username = u.username
      WHERE l.client_code = ?
      LIMIT 1
    `;
    const result = await this.userRepository.query(query, [cdCode]);
    const row = result?.[0];
    if (!row?.created_at) {
      return null;
    }
    return {
      createdAt: new Date(row.created_at),
      isNrb: String(row.isNRB ?? 'N').trim().toUpperCase(),
    };
  }

  /**
   * Daily job (run once per schedule): expired (expiry ≤ today) or expiring within 7 days.
   * No DB log — relies on a single cron run per day to avoid duplicate same-day sends.
   */
  async runDailyNotifications(): Promise<void> {
    const cdCodes = await this.getCdCodesWithFcmTokens();
    this.logger.log(
      `Account expiry FCM job: checking ${cdCodes.length} cd_code(s) with FCM tokens`,
    );

    let sent = 0;
    let skipped = 0;

    for (const cdCode of cdCodes) {
      try {
        const userInfo = await this.getUserSubscriptionInfoByCdCode(cdCode);
        if (!userInfo) {
          skipped++;
          continue;
        }

        if (userInfo.isNrb === 'Y') {
          skipped++;
          continue;
        }

        const expiryDate = addOneYear(userInfo.createdAt);
        const now = new Date();
        const daysUntil = calendarDaysBetween(now, expiryDate);
        const isExpired = daysUntil <= 0;
        const isExpiringSoon = daysUntil > 0 && daysUntil <= 7;

        if (!isExpired && !isExpiringSoon) {
          skipped++;
          continue;
        }

        await this.fcmService.sendAccountExpiryNotification(cdCode, {
          isExpired,
          daysUntilExpiration: daysUntil,
          expirationDateFormatted: formatDdMmYyyy(expiryDate),
        });

        sent++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Account expiry FCM failed for cd_code=${cdCode}: ${msg}`,
        );
      }
    }

    this.logger.log(
      `Account expiry FCM job finished: sent=${sent}, skipped=${skipped}`,
    );
  }
}
