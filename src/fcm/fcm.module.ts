import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FcmBroadcastController } from './fcm-broadcast.controller';
import { FcmController } from './fcm.controller';
import { FcmService } from './fcm.service';
import { FcmTokenService } from './fcm-token.service';
import { FcmToken } from '../entities/fcm-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FcmToken], 'cms22'),
  ],
  controllers: [FcmController, FcmBroadcastController],
  providers: [FcmService, FcmTokenService],
  exports: [FcmService, FcmTokenService],
})
export class FcmModule {}








