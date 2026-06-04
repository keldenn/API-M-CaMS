import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { ProfileUpdateResponseDto } from './dto/profile-update-response.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  async updateEmail(
    username: string,
    cdCode: string,
    dto: UpdateEmailDto,
  ): Promise<ProfileUpdateResponseDto> {
    const email = dto.email.trim().toLowerCase();

    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userResult = await queryRunner.query(
        `UPDATE users SET email = ? WHERE username = ?`,
        [email, username],
      );

      if (!userResult?.affectedRows) {
        throw new NotFoundException({
          error: true,
          message: 'User account not found.',
        });
      }

      const clientResult = await queryRunner.query(
        `UPDATE client_account SET email = ? WHERE cd_code = ?`,
        [email, cdCode],
      );

      if (!clientResult?.affectedRows) {
        throw new NotFoundException({
          error: true,
          message: 'Client account not found for this user.',
        });
      }

      await queryRunner.commitTransaction();

      return {
        error: false,
        message: 'Email updated successfully.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updatePhone(
    username: string,
    cdCode: string,
    dto: UpdatePhoneDto,
  ): Promise<ProfileUpdateResponseDto> {
    const phone = parseInt(dto.phone, 10);
    const phoneStr = dto.phone;

    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userResult = await queryRunner.query(
        `UPDATE users SET phone = ? WHERE username = ?`,
        [phone, username],
      );

      if (!userResult?.affectedRows) {
        throw new NotFoundException({
          error: true,
          message: 'User account not found.',
        });
      }

      const clientResult = await queryRunner.query(
        `UPDATE client_account SET phone = ? WHERE cd_code = ?`,
        [phoneStr, cdCode],
      );

      if (!clientResult?.affectedRows) {
        throw new NotFoundException({
          error: true,
          message: 'Client account not found for this user.',
        });
      }

      await queryRunner.commitTransaction();

      return {
        error: false,
        message: 'Phone updated successfully.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
