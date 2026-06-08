import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const EXPOSURE_CREDIT_REMARKS = 'mcmas exposure credit request';
const EXPOSURE_DEBIT_REMARKS = 'mcmas exposure debit request';

export type ExposureRecord = {
  status: number;
  approval_status: number | null;
  approved_date: string | null;
  amount: string;
  flag: number;
  finance_date: string;
};

export type ExposureInsertParams = {
  cd_code: string;
  amount: number;
};

type ResolvedUserContext = {
  username: string;
  institution_id: number;
};

@Injectable()
export class ExposureService {
  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  async createCredit(params: ExposureInsertParams): Promise<{ finance_id: number }> {
    const context = await this.resolveUserContextByCdCode(params.cd_code);
    return this.insertFinanceRecord({
      ...params,
      ...context,
      amount: params.amount,
      remarks: EXPOSURE_CREDIT_REMARKS,
      flag: 1,
      flag_id: 1,
    });
  }

  async getExposureHistory(cdCode: string): Promise<ExposureRecord[]> {
    const cd_code = cdCode.trim();
    const rows = await this.cms22DataSource.query(
      `SELECT status,
              approval_status,
              approved_date,
              amount,
              flag,
              finance_date
       FROM bbo_finance
       WHERE cd_code = ?
       ORDER BY finance_id DESC`,
      [cd_code],
    );

    if (!rows?.length) {
      return [];
    }

    return rows.map((row: Record<string, unknown>) => ({
      status: Number(row.status ?? 0),
      approval_status:
        row.approval_status === null || row.approval_status === undefined
          ? null
          : Number(row.approval_status),
      approved_date:
        row.approved_date != null ? String(row.approved_date) : null,
      amount: row.amount != null ? String(row.amount) : '0',
      flag: Number(row.flag ?? 0),
      finance_date:
        row.finance_date != null ? String(row.finance_date) : '',
    }));
  }

  async createDebit(params: ExposureInsertParams): Promise<{ finance_id: number }> {
    const context = await this.resolveUserContextByCdCode(params.cd_code);
    return this.insertFinanceRecord({
      ...params,
      ...context,
      amount: -Math.abs(params.amount),
      remarks: EXPOSURE_DEBIT_REMARKS,
      flag: 0,
      flag_id: 0,
    });
  }

  /**
   * Resolves username from `users` (by `cd_code` or `linkuser`) and
   * `institution_id` from `client_account` for the same `cd_code`.
   */
  private async resolveUserContextByCdCode(
    cdCode: string,
  ): Promise<ResolvedUserContext> {
    const cd_code = cdCode.trim();

    const userRows = await this.cms22DataSource.query(
      `SELECT u.username
       FROM users u
       WHERE u.cd_code = ?
       LIMIT 1`,
      [cd_code],
    );

    let username = userRows?.[0]?.username
      ? String(userRows[0].username).trim()
      : '';

    if (!username) {
      const linkRows = await this.cms22DataSource.query(
        `SELECT u.username
         FROM linkuser l
         INNER JOIN users u ON u.username = l.username
         WHERE l.client_code = ?
         LIMIT 1`,
        [cd_code],
      );
      username = linkRows?.[0]?.username
        ? String(linkRows[0].username).trim()
        : '';
    }

    if (!username) {
      throw new BadRequestException('No user found for the given cd_code');
    }

    const accountRows = await this.cms22DataSource.query(
      `SELECT institution_id
       FROM client_account
       WHERE cd_code = ?
       LIMIT 1`,
      [cd_code],
    );

    const rawInstitutionId = accountRows?.[0]?.institution_id;
    const institution_id =
      typeof rawInstitutionId === 'string'
        ? parseInt(rawInstitutionId, 10)
        : Number(rawInstitutionId);

    if (!Number.isFinite(institution_id) || institution_id <= 0) {
      throw new BadRequestException(
        'No institution_id found for the given cd_code',
      );
    }

    return { username, institution_id };
  }

  private async insertFinanceRecord(params: {
    cd_code: string;
    amount: number;
    remarks: string;
    username: string;
    institution_id: number;
    flag: number;
    flag_id: number;
  }): Promise<{ finance_id: number }> {
    const cd_code = params.cd_code.trim();
    const username = params.username.trim();
    const remarks = params.remarks.trim();

    if (!Number.isFinite(params.amount) || params.amount === 0) {
      throw new BadRequestException('Invalid amount');
    }

    try {
      const result = await this.cms22DataSource.query(
        `INSERT INTO bbo_finance
         (cd_code, amount, remarks, flag, flag_id, user_name, institution_id, status, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          cd_code,
          params.amount,
          remarks,
          params.flag,
          params.flag_id,
          username,
          params.institution_id,
        ],
      );

      const finance_id = Number(result?.insertId);
      if (!Number.isFinite(finance_id) || finance_id <= 0) {
        throw new Error('Could not resolve finance_id after insert');
      }

      return { finance_id };
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      console.error('exposure insert failed:', e);
      throw new BadRequestException('Sorry, there was an error.');
    }
  }
}
