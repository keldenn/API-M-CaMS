import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BulkUpdateUnclaimedDto } from './dto/bulk-update-unclaimed.dto';
import {
  UnclaimedDataDto,
  UnclaimedItemDto,
} from './dto/unclaimed-response.dto';

const STATUS_UNDER_VERIFICATION = 'Under Verification';
const AUDIT_USER_ID = 'mcmas';

type UnclaimedRowForUpdate = {
  id: number;
  cid: string | null;
  name_of_bank: string | null;
  account_no: string | null;
  account_holder_cid: string | null;
  account_holder_name: string | null;
  status: string | null;
};

@Injectable()
export class UnclaimedService {
  private readonly logger = new Logger(UnclaimedService.name);

  constructor(
    @InjectDataSource('unclaimed')
    private readonly unclaimedDataSource: DataSource,
  ) {}

  async getByCid(cid: string): Promise<UnclaimedDataDto> {
    const trimmedCid = cid.trim();

    this.logger.debug(`Fetching unclaimed details for cid: ${trimmedCid}`);

    const query = `
      SELECT
        id,
        cd_code,
        name,
        year,
        amount,
        company,
        cid,
        remarks,
        name_of_bank,
        account_no,
        status,
        bank_acc_check
      FROM unclaimed_clients_dtls
      WHERE cid = ?
        AND (status IS NULL OR status <> 'Paid')
      ORDER BY year DESC, company ASC, id ASC
    `;

    const rows = await this.unclaimedDataSource.query(query, [trimmedCid]);

    const items: UnclaimedItemDto[] = rows.map((row: UnclaimedItemDto) => ({
      id: Number(row.id),
      cd_code: row.cd_code ?? null,
      name: row.name ?? null,
      year: row.year ?? null,
      amount: row.amount ?? null,
      company: row.company ?? null,
      cid: row.cid ?? null,
      remarks: row.remarks ?? null,
      name_of_bank: row.name_of_bank ?? null,
      account_no: row.account_no ?? null,
      status: row.status ?? null,
      bank_acc_check:
        row.bank_acc_check === null || row.bank_acc_check === undefined
          ? null
          : Number(row.bank_acc_check),
    }));

    const total_amount = items.reduce(
      (sum, item) => sum + this.parseAmount(item.amount),
      0,
    );

    return {
      cid: trimmedCid,
      total_items: items.length,
      total_amount: Math.round(total_amount * 100) / 100,
      items,
    };
  }

  async bulkUpdate(dto: BulkUpdateUnclaimedDto): Promise<{
    cid: string;
    updated_count: number;
    status: string;
  }> {
    const cid = dto.cid.trim();
    const uniqueIds = [...new Set(dto.ids.map((id) => Number(id)))];
    const nameOfBank = dto.name_of_bank.trim();
    const accountNo = dto.account_no.trim();
    const accountHolderCid = dto.account_holder_cid.trim();
    const accountHolderName = dto.account_holder_name.trim();

    const placeholders = uniqueIds.map(() => '?').join(', ');
    const selectQuery = `
      SELECT
        id,
        cid,
        name_of_bank,
        account_no,
        account_holder_cid,
        account_holder_name,
        status
      FROM unclaimed_clients_dtls
      WHERE id IN (${placeholders})
        AND cid = ?
        AND (status IS NULL OR status <> 'Paid')
    `;

    const queryRunner = this.unclaimedDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingRows: UnclaimedRowForUpdate[] = await queryRunner.query(
        selectQuery,
        [...uniqueIds, cid],
      );

      if (existingRows.length === 0) {
        throw new NotFoundException({
          error: true,
          message: 'No matching unclaimed records found for the given cid/ids',
        });
      }

      if (existingRows.length !== uniqueIds.length) {
        throw new BadRequestException({
          error: true,
          message:
            'One or more ids are invalid, do not belong to this cid, or are already Paid',
        });
      }

      const newValue = JSON.stringify({
        name_of_bank: nameOfBank,
        account_no: accountNo,
        account_holder_cid: accountHolderCid,
        account_holder_name: accountHolderName,
        status: STATUS_UNDER_VERIFICATION,
      });

      for (const row of existingRows) {
        const previousValue = JSON.stringify({
          name_of_bank: row.name_of_bank ?? null,
          account_no: row.account_no ?? null,
          account_holder_cid: row.account_holder_cid ?? null,
          account_holder_name: row.account_holder_name ?? null,
          status: row.status ?? null,
        });

        await queryRunner.query(
          `
            UPDATE unclaimed_clients_dtls
            SET
              name_of_bank = ?,
              account_no = ?,
              account_holder_cid = ?,
              account_holder_name = ?,
              status = ?
            WHERE id = ?
              AND cid = ?
          `,
          [
            nameOfBank,
            accountNo,
            accountHolderCid,
            accountHolderName,
            STATUS_UNDER_VERIFICATION,
            row.id,
            cid,
          ],
        );

        await queryRunner.query(
          `
            INSERT INTO audit_logs
              (div_id, user_id, client_cid, previous_value, new_value)
            VALUES (?, ?, ?, ?, ?)
          `,
          [row.id, AUDIT_USER_ID, cid, previousValue, newValue],
        );
      }

      await queryRunner.commitTransaction();

      this.logger.debug(
        `Bulk updated ${existingRows.length} unclaimed row(s) for cid: ${cid}`,
      );

      return {
        cid,
        updated_count: existingRows.length,
        status: STATUS_UNDER_VERIFICATION,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private parseAmount(amount: string | null): number {
    if (!amount) {
      return 0;
    }

    const cleaned = String(amount).replace(/,/g, '').trim();
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : 0;
  }
}
