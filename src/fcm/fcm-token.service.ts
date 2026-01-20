import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FcmToken } from '../entities/fcm-token.entity';
import { RegisterFcmTokenDto } from './dto/register-token.dto';

@Injectable()
export class FcmTokenService {
  private readonly logger = new Logger(FcmTokenService.name);

  constructor(
    @InjectRepository(FcmToken, 'cms22')
    private readonly fcmTokenRepository: Repository<FcmToken>,
  ) {}

  /**
   * Register or update FCM token for a device
   * Uses UPSERT logic: If cd_code + device_id exists, updates; otherwise creates new entry
   * The unique constraint on (cd_code, device_id) prevents duplicates at database level
   * Uses MySQL's INSERT ... ON DUPLICATE KEY UPDATE for atomic operation to handle race conditions
   */
  async registerToken(dto: RegisterFcmTokenDto): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // First, check if token exists to determine if it's new or update
      const existingToken = await this.fcmTokenRepository.findOne({
        where: {
          cd_code: dto.cd_code,
          device_id: dto.device_id,
        },
      });

      const isNew = !existingToken;
      const now = new Date();

      // Use raw SQL with INSERT ... ON DUPLICATE KEY UPDATE for atomic upsert
      // This handles race conditions better than find + save pattern
      // The unique index on (cd_code, device_id) will trigger the ON DUPLICATE KEY UPDATE
      const query = `
        INSERT INTO fcm_tokens (
          cd_code, 
          fcm_token, 
          device_id, 
          platform, 
          device_name, 
          app_version, 
          last_used_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          fcm_token = VALUES(fcm_token),
          platform = COALESCE(VALUES(platform), platform),
          device_name = COALESCE(VALUES(device_name), device_name),
          app_version = COALESCE(VALUES(app_version), app_version),
          last_used_at = VALUES(last_used_at),
          updated_at = VALUES(updated_at)
      `;

      await this.fcmTokenRepository.query(query, [
        dto.cd_code,
        dto.fcm_token,
        dto.device_id,
        dto.platform || null,
        dto.device_name || null,
        dto.app_version || null,
        now,
        now,
        now,
      ]);

      // Fetch the final token record to return complete data
      const token = await this.fcmTokenRepository.findOne({
        where: {
          cd_code: dto.cd_code,
          device_id: dto.device_id,
        },
      });

      if (!token) {
        throw new BadRequestException('Failed to retrieve registered FCM token');
      }

      this.logger.log(
        `${isNew ? 'Registered new' : 'Updated'} FCM token for cd_code: ${dto.cd_code}, device_id: ${dto.device_id}`,
      );

      return {
        success: true,
        message: isNew 
          ? 'FCM token registered successfully' 
          : 'FCM token updated successfully',
        data: {
          fcm_token_id: token.fcm_token_id,
          cd_code: token.cd_code,
          device_id: token.device_id,
          is_new: isNew,
        },
      };
    } catch (error) {
      this.logger.error('Error registering FCM token:', error);
      
      // Check if error is due to unique constraint violation (shouldn't happen with ON DUPLICATE KEY UPDATE)
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        // Fallback: try to fetch and return the existing token
        try {
          const existingToken = await this.fcmTokenRepository.findOne({
            where: {
              cd_code: dto.cd_code,
              device_id: dto.device_id,
            },
          });

          if (existingToken) {
            return {
              success: true,
              message: 'FCM token already exists',
              data: {
                fcm_token_id: existingToken.fcm_token_id,
                cd_code: existingToken.cd_code,
                device_id: existingToken.device_id,
                is_new: false,
              },
            };
          }
        } catch (fetchError) {
          // If fetch also fails, throw the original error
        }
      }
      
      throw new BadRequestException('Failed to register FCM token');
    }
  }

  /**
   * Get all FCM tokens for a cd_code
   */
  async getTokensByCdCode(cdCode: string): Promise<FcmToken[]> {
    try {
      const tokens = await this.fcmTokenRepository.find({
        where: { cd_code: cdCode },
        order: { created_at: 'DESC' },
      });

      return tokens;
    } catch (error) {
      this.logger.error(`Error fetching tokens for cd_code ${cdCode}:`, error);
      throw new BadRequestException('Failed to fetch FCM tokens');
    }
  }

  /**
   * Get all active FCM token strings for a cd_code (for sending notifications)
   */
  async getActiveTokenStringsByCdCode(cdCode: string): Promise<string[]> {
    try {
      const tokens = await this.fcmTokenRepository.find({
        where: { cd_code: cdCode },
        select: ['fcm_token'],
      });

      return tokens.map((t) => t.fcm_token);
    } catch (error) {
      this.logger.error(
        `Error fetching active token strings for cd_code ${cdCode}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Delete FCM token by device_id and cd_code
   */
  async deleteToken(cdCode: string, deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.fcmTokenRepository.delete({
        cd_code: cdCode,
        device_id: deviceId,
      });

      if (result.affected === 0) {
        throw new NotFoundException(
          `No FCM token found for cd_code: ${cdCode}, device_id: ${deviceId}`,
        );
      }

      this.logger.log(
        `Deleted FCM token for cd_code: ${cdCode}, device_id: ${deviceId}`,
      );

      return {
        success: true,
        message: 'FCM token deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error deleting FCM token:', error);
      throw new BadRequestException('Failed to delete FCM token');
    }
  }

  /**
   * Delete all FCM tokens for a cd_code
   */
  async deleteAllTokensForCdCode(cdCode: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const result = await this.fcmTokenRepository.delete({ cd_code: cdCode });

      this.logger.log(
        `Deleted ${result.affected || 0} FCM tokens for cd_code: ${cdCode}`,
      );

      return {
        success: true,
        message: 'All FCM tokens deleted successfully',
        count: result.affected || 0,
      };
    } catch (error) {
      this.logger.error('Error deleting FCM tokens:', error);
      throw new BadRequestException('Failed to delete FCM tokens');
    }
  }

  /**
   * Update last_used_at timestamp for tokens
   */
  async updateLastUsed(tokens: string[]): Promise<void> {
    try {
      await this.fcmTokenRepository
        .createQueryBuilder()
        .update(FcmToken)
        .set({ last_used_at: new Date() })
        .where('fcm_token IN (:...tokens)', { tokens })
        .execute();
    } catch (error) {
      this.logger.warn('Error updating last_used_at:', error);
      // Don't throw - this is not critical
    }
  }
}




