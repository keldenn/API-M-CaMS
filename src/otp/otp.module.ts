import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { SmsOtpLog } from '../entities/sms-otp-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsOtpLog]),
    ConfigModule,
  ],
  providers: [OtpService],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}
