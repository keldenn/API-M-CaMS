import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  UnclaimedDataDto,
  UnclaimedItemDto,
} from './dto/unclaimed-response.dto';

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

  private parseAmount(amount: string | null): number {
    if (!amount) {
      return 0;
    }

    const cleaned = String(amount).replace(/,/g, '').trim();
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : 0;
  }
}
