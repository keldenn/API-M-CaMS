import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { GetUserDetailsDto } from './dto/get-user-details.dto';
import { SubmitFormRenewDto } from './dto/submit-form-renew.dto';
import { PaymentSuccessOrDto } from './dto/payment-success-or.dto';

@Injectable()
export class RenewService {
  constructor(
    @InjectRepository(User, 'cms22')
    private readonly userRepository: Repository<User>,
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  async getUserDetailsByUsername(dto: GetUserDetailsDto): Promise<{
    status: string;
    message: string;
    data?: any[];
  }> {
    const username = dto.username;

    const count = await this.userRepository
      .createQueryBuilder('u')
      .where('u.username = :username', { username })
      .andWhere('u.role_id = :roleId', { roleId: 4 })
      .getCount();

    if (count < 1) {
      return {
        status: '100',
        message: 'Please enter a valid username.',
      };
    }

    const inactiveCount = await this.userRepository
      .createQueryBuilder('u')
      .where('u.username = :username', { username })
      .andWhere('u.status = :status', { status: 0 })
      .andWhere('u.role_id = :roleId', { roleId: 4 })
      .getCount();

    if (inactiveCount < 1) {
      return {
        status: '100',
        message: 'Your mCaMS account is still active. Cannot renew before expires.',
      };
    }

    const result = await this.userRepository.query(
      `SELECT
         l.client_code,
         u.name,
         u.cid,
         u.participant_code,
         u.username,
         u.phone,
         u.email,
         u.address
       FROM users u
       INNER JOIN linkuser l ON u.username = l.username
       WHERE u.username = ?
         AND u.status = 0
         AND u.role_id = 4`,
      [username],
    );

    return {
      status: '200',
      message: 'Your account has expired.',
      data: result,
    };
  }

  async submitFormCaMSRenewalNew(dto: SubmitFormRenewDto): Promise<{
    status: string;
    message: string;
    email?: string;
    app_fee?: number;
    gst?: number;
    date?: string;
    order_no?: string;
    data?: {
      insert: boolean;
      update: boolean;
    };
  }> {
    const systime = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const orderNo = dto.orderNo;

    if (dto.email === '0' || dto.email === 'NULL' || dto.email === '') {
      return {
        status: '100',
        message: 'Email cannot be empty.',
      };
    }

    const gst = dto.gst ?? 0;
    const fee = dto.fee ?? 0;

    const users = await this.userRepository.query(
      `SELECT * FROM users WHERE username = ? LIMIT 1`,
      [dto.userName],
    );
    const user = users?.[0];

    if (!user) {
      return {
        status: '400',
        message: 'User not found.',
      };
    }

    const auditData = {
      user_online_id: user.user_id ?? 0,
      cid: user.cid ?? '0',
      cd_code: dto.cdCode ?? user.cd_code ?? '',
      name: user.name ?? '',
      participant_code: user.participant_code ?? '',
      phone: user.phone ?? '',
      email: dto.email ?? user.email ?? '',
      address: user.address ?? '',
      broker_user: user.username ?? '',
      status: user.status ?? 0,
      app_fee: fee,
      gst: gst,
      fee_status: 0,
      order_no: orderNo,
    };

    let insert = false;
    try {
      const insertResult = await this.userRepository.query(
        `INSERT INTO api_online_terminal_audit
        (user_online_id, cid, cd_code, name, participant_code, phone, email, address, broker_user, status, app_fee, gst, fee_status, order_no, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          auditData.user_online_id,
          auditData.cid,
          auditData.cd_code,
          auditData.name,
          auditData.participant_code,
          auditData.phone,
          auditData.email,
          auditData.address,
          auditData.broker_user,
          auditData.status,
          auditData.app_fee,
          auditData.gst,
          auditData.fee_status,
          auditData.order_no,
        ],
      );

      insert = !!insertResult;
    } catch (error) {
      console.error('Failed to insert into audit table:', error?.message);
      insert = false;
    }

    let updateResult: any;
    try {
      updateResult = await this.userRepository.query(
        `UPDATE users
         SET cd_code = ?, amount = ?, amt_status = 0, orderNo = ?, gst = ?
         WHERE username = ? AND status = 0 AND role_id = 4`,
        [dto.cdCode ?? user.cd_code, fee, orderNo, gst, dto.userName],
      );
    } catch (error) {
      // Some schemas do not have users.gst column.
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        updateResult = await this.userRepository.query(
          `UPDATE users
           SET cd_code = ?, amount = ?, amt_status = 0, orderNo = ?
           WHERE username = ? AND status = 0 AND role_id = 4`,
          [dto.cdCode ?? user.cd_code, fee, orderNo, dto.userName],
        );
      } else {
        throw error;
      }
    }

    const affectedRows = Number(updateResult?.affectedRows ?? 0);
    const update = affectedRows > 0;

    if (insert && update) {
      return {
        status: '200',
        message: 'Application submitted successfully.',
        email: dto.email,
        app_fee: fee,
        gst: gst,
        date: systime,
        order_no: orderNo,
      };
    }

    console.error('Form submission failed', {
      username: dto.userName,
      order_no: orderNo,
      insert_success: insert,
      update_success: update,
      audit_data: auditData,
    });

    return {
      status: '400',
      message: 'Something went wrong. Please try again later.',
      data: {
        insert,
        update,
      },
    };
  }

  async paymentSuccessOR2(dto: PaymentSuccessOrDto): Promise<{
    status: string;
    message: string;
    email?: string;
    app_fee?: number;
    date?: string;
    order_no?: string;
    error?: string;
  }> {
    const orderNo = dto.orderNo;
    const currentTimestamp = new Date();
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const authCode = dto.auth_code ?? '00';
      const msgType = dto.msg_type ?? 'AC';
      if (authCode !== '00' || msgType !== 'AC') {
        throw new Error(
          `Payment not successful. Expected auth_code=00 and msg_type=AC but received auth_code=${authCode}, msg_type=${msgType}`,
        );
      }

      const users = await queryRunner.query(
        `SELECT * FROM users WHERE orderNo = ? LIMIT 1`,
        [orderNo],
      );
      const user = users?.[0];
      if (!user) {
        throw new Error('User not found!');
      }

      const updateStatus = await queryRunner.query(
        `UPDATE users
         SET amt_status = 1, status = 1, created_at = NOW()
         WHERE orderNo = ? AND amt_status = 0`,
        [orderNo],
      );
      const updatedRows = Number(updateStatus?.affectedRows ?? 0);
      if (updatedRows < 1) {
        throw new Error('Updating amt_status failed!');
      }

      // insertUsing equivalent from users -> emd
      try {
        await queryRunner.query(
          `INSERT INTO emd (cid, cd_code, name, phone, email, app_fee, gst, fee_status, order_no, user_online_id)
           SELECT cid, cd_code, name, phone, email, amount AS app_fee, gst AS gst, amt_status AS fee_status, orderNo AS order_no, user_id AS user_online_id
           FROM users
           WHERE orderNo = ?`,
          [orderNo],
        );
      } catch (error) {
        // Fallback for schemas where emd/users may not have gst column
        if (error?.code === 'ER_BAD_FIELD_ERROR') {
          await queryRunner.query(
            `INSERT INTO emd (cid, cd_code, name, phone, email, app_fee, fee_status, order_no, user_online_id)
             SELECT cid, cd_code, name, phone, email, amount AS app_fee, amt_status AS fee_status, orderNo AS order_no, user_id AS user_online_id
             FROM users
             WHERE orderNo = ?`,
            [orderNo],
          );
        } else {
          throw error;
        }
      }

      const insertInvestment = await queryRunner.query(
        `INSERT INTO investment_temp_response (order_number, investment_amount, auth_code, msg_type)
         VALUES (?, ?, '00', 'AC')`,
        [orderNo, dto.fee ?? 0],
      );

      if (!insertInvestment) {
        throw new Error('Insert into investment_temp_response failed!');
      }

      await queryRunner.commitTransaction();

      return {
        status: '200',
        message: 'Renewal application submitted successfully.',
        email: dto.email,
        app_fee: dto.fee,
        date: currentTimestamp
          .toISOString()
          .replace(/[-:T.Z]/g, '')
          .slice(0, 14),
        order_no: orderNo,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return {
        status: '400',
        message: 'Transaction failed!',
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }
}
