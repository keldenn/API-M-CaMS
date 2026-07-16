import { Module } from '@nestjs/common';
import { RightsController } from './rights.controller';
import { RightsService } from './rights.service';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [FcmModule],
  controllers: [RightsController],
  providers: [RightsService],
  exports: [RightsService],
})
export class RightsModule {}
