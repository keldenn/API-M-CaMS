import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { RightsCheckExistItemDto } from './dto/check-exist-response.dto';
import { ActiveRightsOfferDto } from './dto/active-rights-response.dto';
import { FcmService } from '../fcm/fcm.service';
import { NotifyEligibleRightsResponseDto } from './dto/notify-eligible-response.dto';

type ClientRightsContext = {
  cid: string;
  email: string;
  phone: string;
};

type RightsTempRecord = {
  cd_code: string;
  symbol_id: number;
  vol_applied: number;
  amount: number;
  email: string;
  phone: string;
  cid: string;
};

type RightsIssueUpsertOptions = {
  issueType: 'S' | 'R';
  renounceCdCode?: string;
};

type EligibleRightsClient = {
  cd_code: string;
  available_rights: number;
};

export type SubscribeRightsParams = {
  cdCode: string;
  symbolId: number;
  orderNo: string;
  amount: number;
  volApplied: number;
  price: number;
  details: string;
};

export type HandleRightsCallbackResult = {
  orderNo: string;
  orderId: number;
  emailStatus: number;
  smsSent: boolean;
  emailSent: boolean;
};

@Injectable()
export class RightsService {
  private readonly logger = new Logger(RightsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly fcmService: FcmService,
  ) {}

  async getActiveRightsOffers(): Promise<ActiveRightsOfferDto[]> {
    const rows = await this.dataSource.query(
      `SELECT symbol_id, start_at, end_at, corp_announcement_id, issue_price, status
       FROM rights_offers
       WHERE status = 1
         AND end_at >= NOW()
       ORDER BY start_at DESC`,
    );

    if (!rows?.length) {
      return [];
    }

    return rows.map((row: Record<string, unknown>) => ({
      symbol_id: Number(row.symbol_id ?? 0),
      start_at: row.start_at != null ? String(row.start_at) : '',
      end_at: row.end_at != null ? String(row.end_at) : '',
      corp_announcement_id: Number(row.corp_announcement_id ?? 0),
      issue_price:
        row.issue_price != null ? Number(row.issue_price) : null,
      status: Number(row.status ?? 0),
    }));
  }

  async checkRightsExist(
    cdCode: string,
    symbolId: number,
    corpAnnouncementId: number,
  ): Promise<{ data: RightsCheckExistItemDto[]; rate: number | null }> {
    const rateRows = await this.dataSource.query(
      `SELECT rate
       FROM corporate_announcement
       WHERE corp_announcement_id = ?
       LIMIT 1`,
      [corpAnnouncementId],
    );
    const rate =
      rateRows?.[0]?.rate != null ? Number(rateRows[0].rate) : null;

    const query = `
      SELECT
        a.client_id,
        a.cd_code,
        a.f_name,
        a.l_name,
        a.phone,
        a.email,
        a.bank_id,
        a.bank_account,
        s.volume,
        s.ribon_volume,
        s.record_date,
        COALESCE(SUM(r.order_size), 0) AS order_total,
        (s.ribon_volume - COALESCE(SUM(r.order_size), 0)) AS available_rights
      FROM client_account AS a
      INNER JOIN spot_date_holding AS s
        ON a.client_id = s.client_id
      LEFT JOIN rights_issue AS r
        ON a.cd_code = r.cd_code
        AND r.symbol_id = ?
        AND r.type IN ('S', 'R')
      WHERE
        a.cd_code = ?
        AND s.corp_announcement_id = ?
        AND s.symbol_id = ?
        AND s.status = 1
        AND s.ribon_volume > 0
      GROUP BY
        a.client_id,
        a.cd_code,
        a.f_name,
        a.l_name,
        a.phone,
        a.email,
        a.bank_id,
        a.bank_account,
        s.volume,
        s.ribon_volume,
        s.record_date
    `;

    const rows = await this.dataSource.query(query, [
      symbolId,
      cdCode.trim(),
      corpAnnouncementId,
      symbolId,
    ]);

    if (!rows?.length) {
      return { data: [], rate };
    }

    return {
      rate,
      data: rows.map((row: Record<string, unknown>) => ({
        client_id: Number(row.client_id),
        cd_code: String(row.cd_code ?? '').trim(),
        f_name: String(row.f_name ?? '').trim(),
        l_name: String(row.l_name ?? '').trim(),
        phone: String(row.phone ?? '').trim(),
        email: String(row.email ?? '').trim(),
        bank_id: Number(row.bank_id ?? 0),
        bank_account: String(row.bank_account ?? '').trim(),
        volume: Number(row.volume ?? 0),
        ribon_volume: Number(row.ribon_volume ?? 0),
        record_date:
          row.record_date != null ? String(row.record_date).slice(0, 10) : '',
        order_total: Number(row.order_total ?? 0),
        available_rights: Number(row.available_rights ?? 0),
      })),
    };
  }

  /**
   * Find all clients eligible for a rights offer (available_rights > 0).
   */
  async findEligibleRightsClients(
    symbolId: number,
    corpAnnouncementId: number,
  ): Promise<EligibleRightsClient[]> {
    const query = `
      SELECT
        a.cd_code,
        (s.ribon_volume - COALESCE(SUM(r.order_size), 0)) AS available_rights
      FROM client_account AS a
      INNER JOIN spot_date_holding AS s
        ON a.client_id = s.client_id
      LEFT JOIN rights_issue AS r
        ON a.cd_code = r.cd_code
        AND r.symbol_id = ?
        AND r.type IN ('S', 'R')
      WHERE
        s.corp_announcement_id = ?
        AND s.symbol_id = ?
        AND s.status = 1
        AND s.ribon_volume > 0
        AND a.cd_code IS NOT NULL
        AND TRIM(a.cd_code) != ''
      GROUP BY
        a.cd_code,
        s.ribon_volume
      HAVING available_rights > 0
    `;

    const rows = await this.dataSource.query(query, [
      symbolId,
      corpAnnouncementId,
      symbolId,
    ]);

    if (!rows?.length) {
      return [];
    }

    return rows.map((row: Record<string, unknown>) => ({
      cd_code: String(row.cd_code ?? '').trim(),
      available_rights: Number(row.available_rights ?? 0),
    }));
  }

  async notifyEligibleRightsClients(
    symbolId: number,
    corpAnnouncementId: number,
  ): Promise<Omit<NotifyEligibleRightsResponseDto, 'error' | 'message'>> {
    const eligible = await this.findEligibleRightsClients(
      symbolId,
      corpAnnouncementId,
    );
    const symbol = await this.getSymbolCode(symbolId);

    let notifiedCount = 0;
    let skippedNoToken = 0;
    let failedCount = 0;

    this.logger.log(
      `Rights notify: ${eligible.length} eligible client(s) for symbol_id=${symbolId}, corp_announcement_id=${corpAnnouncementId}`,
    );

    for (const client of eligible) {
      try {
        const result = await this.fcmService.sendRightsOfferNotification(
          client.cd_code,
          {
            symbol,
            symbolId,
            corpAnnouncementId,
            availableRights: client.available_rights,
          },
        );

        if (result.successCount > 0) {
          notifiedCount++;
        } else if (
          result.successCount === 0 &&
          result.failureCount === 0
        ) {
          // No tokens registered for this cd_code
          skippedNoToken++;
        } else {
          failedCount++;
        }
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Rights FCM failed for cd_code=${client.cd_code}: ${msg}`,
        );
      }
    }

    this.logger.log(
      `Rights notify finished: eligible=${eligible.length}, notified=${notifiedCount}, skipped_no_token=${skippedNoToken}, failed=${failedCount}`,
    );

    return {
      eligible_count: eligible.length,
      notified_count: notifiedCount,
      skipped_no_token: skippedNoToken,
      failed_count: failedCount,
    };
  }

  private async getSymbolCode(symbolId: number): Promise<string> {
    try {
      const rows = await this.dataSource.query(
        `SELECT symbol FROM symbol WHERE symbol_id = ? LIMIT 1`,
        [symbolId],
      );
      const code = String(rows?.[0]?.symbol ?? '').trim();
      return code || `Symbol #${symbolId}`;
    } catch {
      return `Symbol #${symbolId}`;
    }
  }

  async subscribeRights(params: SubscribeRightsParams): Promise<number> {
    const cdCode = params.cdCode.trim();
    const client = await this.getClientContextByCdCode(cdCode);

    const query = `
      INSERT INTO rights_issue_online_temp
      (
        bfs_orderid,
        dateentry,
        cd_code,
        symbol_id,
        amount,
        payment_status,
        type,
        name,
        email,
        phone,
        vol_applied,
        price,
        details,
        employee_id,
        AS_Check,
        client_acc_check
      )
      VALUES
      (
        ?,
        NOW(),
        ?,
        ?,
        ?,
        'PE',
        'AR',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        '0',
        0
      )
    `;

    const result = await this.dataSource.query(query, [
      params.orderNo.trim(),
      cdCode,
      params.symbolId,
      params.amount,
      client.cid,
      client.email,
      client.phone,
      params.volApplied,
      params.price,
      params.details.trim(),
      client.cid,
    ]);

    return Number(result?.insertId ?? 0);
  }

  async handleRightsCallback(
    orderNo: string,
    tokenCdCode: string,
  ): Promise<HandleRightsCallbackResult> {
    return this.processRightsPaymentCallback(orderNo, tokenCdCode, {
      issueType: 'S',
      notificationKind: 'subscription',
    });
  }

  async subscribeRenounce(
    orderNo: string,
    tokenCdCode: string,
    renounceCdCode: string,
  ): Promise<HandleRightsCallbackResult> {
    return this.processRightsPaymentCallback(orderNo, tokenCdCode, {
      issueType: 'R',
      renounceCdCode: renounceCdCode.trim(),
      notificationKind: 'renounce',
    });
  }

  private async processRightsPaymentCallback(
    orderNo: string,
    tokenCdCode: string,
    options: RightsIssueUpsertOptions & {
      notificationKind: 'subscription' | 'renounce';
    },
  ): Promise<HandleRightsCallbackResult> {
    const normalizedOrderNo = orderNo.trim();
    const normalizedCdCode = tokenCdCode.trim();

    const tempRecords = await this.getSubscriptionTempRecords(normalizedOrderNo);
    if (!tempRecords.length) {
      throw new BadRequestException(
        'No pending rights subscription found for this order',
      );
    }

    for (const record of tempRecords) {
      if (record.cd_code !== normalizedCdCode) {
        throw new ForbiddenException(
          'CD code does not match authenticated user',
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let orderId = 0;

    try {
      await queryRunner.query(
        `UPDATE rights_issue_online_temp
         SET bfs_code = '00', type = 'AC'
         WHERE bfs_orderid = ?`,
        [normalizedOrderNo],
      );

      for (const record of tempRecords) {
        orderId = await this.upsertRightsIssueRecord(queryRunner, record, {
          issueType: options.issueType,
          renounceCdCode: options.renounceCdCode,
        });
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const primaryRecord = tempRecords[0];
    const notificationMessage = this.buildRightsNotificationMessage(
      normalizedOrderNo,
      primaryRecord,
      options.notificationKind,
      options.renounceCdCode,
    );
    const smsSent = primaryRecord.phone
      ? await this.sendSms(primaryRecord.phone, notificationMessage)
      : false;
    const emailSent = primaryRecord.email
      ? await this.sendRightsEmail(
          primaryRecord.email,
          normalizedOrderNo,
          notificationMessage,
          options.notificationKind,
        )
      : false;

    let emailStatus = 0;
    if (smsSent || emailSent) {
      await this.dataSource.query(
        `UPDATE rights_issue
         SET email_status = 1
         WHERE order_id = ?`,
        [orderId],
      );
      emailStatus = 1;
    }

    return {
      orderNo: normalizedOrderNo,
      orderId,
      emailStatus,
      smsSent,
      emailSent,
    };
  }

  private async getSubscriptionTempRecords(
    orderNo: string,
  ): Promise<RightsTempRecord[]> {
    const rows = await this.dataSource.query(
      `SELECT *
       FROM rights_issue_online_temp
       WHERE bfs_orderid = ?
         AND CAST(vol_applied AS UNSIGNED) > 0`,
      [orderNo],
    );

    if (!rows?.length) {
      return [];
    }

    return rows.map((row: Record<string, unknown>) => ({
      cd_code: String(row.cd_code ?? '').trim(),
      symbol_id: Number(row.symbol_id ?? 0),
      vol_applied: Number(row.vol_applied ?? 0),
      amount: Number(row.amount ?? 0),
      email: String(row.email ?? '').trim(),
      phone: String(row.phone ?? '').trim(),
      cid: String(row.name ?? '').trim(),
    }));
  }

  private async upsertRightsIssueRecord(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    record: RightsTempRecord,
    options: RightsIssueUpsertOptions,
  ): Promise<number> {
    const existing =
      options.issueType === 'R'
        ? await this.findExistingRenounceRecord(
            queryRunner,
            record,
            options.renounceCdCode ?? '',
          )
        : await this.findExistingSubscribeRecord(queryRunner, record);

    if (existing) {
      const existingOrderSize = Number(existing.order_size ?? 0);
      const existingTotalAmount = Number(existing.total_amount ?? 0);
      const newOrderSize = existingOrderSize + record.vol_applied;
      const newTotalAmount = existingTotalAmount + record.amount;
      const rightsIssued = this.padOrderSize(newOrderSize);
      const orderId = Number(existing.order_id);

      await queryRunner.query(
        `UPDATE rights_issue
         SET order_size = ?,
             total_amount = ?,
             rights_issued = ?
         WHERE order_id = ?`,
        [newOrderSize, newTotalAmount, rightsIssued, orderId],
      );

      return orderId;
    }

    const rightsIssued = this.padOrderSize(record.vol_applied);
    const insertResult = await queryRunner.query(
      `INSERT INTO rights_issue
      (
        type,
        cd_code,
        order_size,
        renounce_cd_code,
        order_size_final,
        symbol_id,
        buy_vol,
        allocated_size,
        rights_issued,
        face_value,
        total_amount,
        available_rights,
        price_discovered,
        user_name,
        cid_no,
        status,
        order_date,
        email_status
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        0,
        ?,
        0,
        0,
        ?,
        10,
        ?,
        0,
        0,
        ?,
        ?,
        0,
        NOW(),
        0
      )`,
      [
        options.issueType,
        record.cd_code,
        record.vol_applied,
        options.issueType === 'R' ? (options.renounceCdCode ?? '') : '',
        record.symbol_id,
        rightsIssued,
        record.amount,
        record.cid,
        record.cid,
      ],
    );

    return Number(insertResult?.insertId ?? 0);
  }

  private async findExistingSubscribeRecord(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    record: RightsTempRecord,
  ): Promise<Record<string, unknown> | undefined> {
    const rows = await queryRunner.query(
      `SELECT *
       FROM rights_issue
       WHERE cd_code = ?
         AND symbol_id = ?
         AND type = 'S'
       LIMIT 1`,
      [record.cd_code, record.symbol_id],
    );

    return rows?.[0];
  }

  private async findExistingRenounceRecord(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    record: RightsTempRecord,
    renounceCdCode: string,
  ): Promise<Record<string, unknown> | undefined> {
    const rows = await queryRunner.query(
      `SELECT *
       FROM rights_issue
       WHERE cd_code = ?
         AND symbol_id = ?
         AND type = 'R'
         AND TRIM(renounce_cd_code) = ?
       LIMIT 1`,
      [record.cd_code, record.symbol_id, renounceCdCode.trim()],
    );

    return rows?.[0];
  }

  private padOrderSize(size: number): string {
    return String(Math.trunc(size)).padStart(10, '0');
  }

  private buildRightsNotificationMessage(
    orderNo: string,
    record: RightsTempRecord,
    kind: 'subscription' | 'renounce' = 'subscription',
    renounceCdCode?: string,
  ): string {
    if (kind === 'renounce') {
      return `Your rights renounce (Order: ${orderNo}) has been confirmed. CD Code: ${record.cd_code}, Renounce CD Code: ${renounceCdCode ?? ''}, Volume: ${record.vol_applied}, Amount: ${record.amount}.`;
    }

    return `Your rights subscription (Order: ${orderNo}) has been confirmed. CD Code: ${record.cd_code}, Volume: ${record.vol_applied}, Amount: ${record.amount}.`;
  }

  private async sendSms(phoneNo: string, message: string): Promise<boolean> {
    try {
      const token = 'rsebsms@2021#Dec!';
      const url = 'https://cms.rsebl.org.bt/api/v1/rseb_sms_gateway.php';
      const formData = new URLSearchParams();
      formData.append('phoneNo', phoneNo);
      formData.append('message', message);
      formData.append('token', token);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const result = await response.text();
      return result === 'SENT';
    } catch (error) {
      console.error('Rights callback SMS error:', error);
      return false;
    }
  }

  private async sendRightsEmail(
    email: string,
    orderNo: string,
    message: string,
    kind: 'subscription' | 'renounce' = 'subscription',
  ): Promise<boolean> {
    try {
      const smtpPort = Number(this.configService.get<number>('SMTP_PORT') || 587);
      const isSecure = smtpPort === 465;
      const transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
        port: smtpPort,
        secure: isSecure,
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });

      const subject =
        kind === 'renounce'
          ? `Rights Renounce Confirmed - ${orderNo}`
          : `Rights Subscription Confirmed - ${orderNo}`;

      await transporter.sendMail({
        from:
          this.configService.get<string>('SMTP_FROM') ||
          this.configService.get<string>('SMTP_USER') ||
          'noreply@example.com',
        to: email,
        subject,
        text: message,
      });

      return true;
    } catch (error) {
      console.error('Rights callback email error:', error);
      return false;
    }
  }

  private async getClientContextByCdCode(
    cdCode: string,
  ): Promise<ClientRightsContext> {
    const rows = await this.dataSource.query(
      `SELECT ID, email, phone
       FROM client_account
       WHERE cd_code = ?
       LIMIT 1`,
      [cdCode],
    );

    const row = rows?.[0];
    if (!row) {
      throw new BadRequestException('Client account not found');
    }

    const cid = String(row.ID ?? '').trim();
    const email = String(row.email ?? '').trim();
    const phone = String(row.phone ?? '').trim();

    if (!cid) {
      throw new BadRequestException('CID not found for client account');
    }
    if (!email) {
      throw new BadRequestException('Email not found for client account');
    }
    if (!phone) {
      throw new BadRequestException('Phone not found for client account');
    }

    return { cid, email, phone };
  }
}
