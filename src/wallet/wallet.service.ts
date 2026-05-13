import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { McamsWallet } from '../entities/mcams-wallet.entity';

const MCAMS_INSTITUTION_ID = 230822044455;
const WITHDRAW_BBO_USER = 'MEMRNRB001';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(McamsWallet, 'cms22')
    private readonly walletRepository: Repository<McamsWallet>,
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  async getWalletBalance(cdCode: string): Promise<string> {
    const query = 'SELECT sum(amount) as total FROM mcams_wallet WHERE cd_code = ?';
    const result = await this.walletRepository.query(query, [cdCode]);
    const total = result?.[0]?.total;

    if (total === null || total === undefined) {
      return '0';
    }

    return String(total);
  }

  /**
   * Same as legacy PHP WalletTrxHistory:
   * SELECT amount, SUBSTRING(trx_time,1,10) AS trx_time, type, paid_to_user
   * FROM mcams_wallet WHERE cd_code = ? ORDER BY wallet_id DESC
   */
  async getWalletTrxHistory(cdCode: string): Promise<
    { amount: string; trx_time: string; type: string; paid_to_user: string }[]
  > {
    const query = `
      SELECT amount,
             SUBSTRING(trx_time, 1, 10) AS trx_time,
             type,
             paid_to_user
      FROM mcams_wallet
      WHERE cd_code = ?
      ORDER BY wallet_id DESC
    `;
    const rows = await this.walletRepository.query(query, [cdCode]);
    if (!rows?.length) {
      return [];
    }
    return rows.map((row: Record<string, unknown>) => ({
      amount: row.amount != null ? String(row.amount) : '0',
      trx_time: row.trx_time != null ? String(row.trx_time) : '',
      type: row.type != null ? String(row.type) : '',
      paid_to_user:
        row.paid_to_user != null ? String(row.paid_to_user) : '',
    }));
  }

  /**
   * Legacy PHP WithdrawWalletBalance: log, balance check, insert wallet + bbo_finance.
   */
  async withdrawWallet(params: {
    amount: number;
    cd_code: string;
    username: string;
  }): Promise<{ message: string }> {
    const amount = Number(params.amount);
    const cd_code = params.cd_code.trim();
    const username = params.username.trim();

    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('You cannot withdraw Nu. 0');
    }
    if (amount < 0) {
      throw new BadRequestException('Invalid withdrawal amount');
    }

    const endpointPayload = JSON.stringify({
      WithdrawWalletBalance: 'WithdrawWalletBalance',
      Amount: amount,
      cd_code,
      username,
    });
    await this.logMobileApiRequest(endpointPayload, username);

    const sumRows = await this.walletRepository.query(
      'SELECT sum(amount) as total FROM mcams_wallet WHERE cd_code = ?',
      [cd_code],
    );
    const rawTotal = sumRows?.[0]?.total;
    const total =
      rawTotal === null || rawTotal === undefined
        ? 0
        : parseFloat(String(rawTotal));

    if (total < amount) {
      const max = total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      throw new BadRequestException(`You can only withdraw Max. of NU.${max}`);
    }

    const negAmount = amount * -1;
    const type = 'DR';

    try {
      await this.cms22DataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO mcams_wallet (cd_code, amount, type, trx_time)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [cd_code, negAmount, type],
        );

        const widRows = await manager.query(
          `SELECT wallet_id FROM mcams_wallet WHERE cd_code = ? ORDER BY wallet_id DESC LIMIT 1`,
          [cd_code],
        );
        const wallet_id = widRows?.[0]?.wallet_id;
        if (wallet_id === undefined || wallet_id === null) {
          throw new Error('Could not resolve wallet_id after insert');
        }

        await manager.query(
          `INSERT INTO bbo_finance (cd_code, amount, remarks, flag, flag_id, user_name, institution_id)
           VALUES (?, ?, 'Wallet Withdraw', 0, ?, ?, ?)`,
          [
            cd_code,
            negAmount,
            String(wallet_id),
            WITHDRAW_BBO_USER,
            MCAMS_INSTITUTION_ID,
          ],
        );
      });
    } catch (e) {
      console.error('withdrawWallet transaction failed:', e);
      throw new BadRequestException('Sorry, there was an error.');
    }

    return {
      message:
        'Successful, Your bank account will be credited within 1 or 2 working days.',
    };
  }

  private async logMobileApiRequest(
    endpoint: string,
    user: string,
  ): Promise<void> {
    const query = `
      INSERT INTO mobile_api_log (date, endpoint, user)
      VALUES (NOW(), ?, ?)
    `;
    await this.cms22DataSource.query(query, [endpoint, user]);
  }
}
