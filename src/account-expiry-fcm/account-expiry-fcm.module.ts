import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { FcmToken } from '../entities/fcm-token.entity';
import { FcmModule } from '../fcm/fcm.module';
import { AccountExpiryFcmService } from './account-expiry-fcm.service';
import { AccountExpiryFcmScheduler } from './account-expiry-fcm.scheduler';

@Module({
  imports: [
    FcmModule,
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([FcmToken], 'cms22'),
  ],
  providers: [AccountExpiryFcmService, AccountExpiryFcmScheduler],
  exports: [AccountExpiryFcmService],
})
export class AccountExpiryFcmModule {}
