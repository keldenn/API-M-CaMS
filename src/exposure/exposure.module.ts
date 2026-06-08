import { Module } from '@nestjs/common';
import { ExposureController } from './exposure.controller';
import { ExposureService } from './exposure.service';

@Module({
  controllers: [ExposureController],
  providers: [ExposureService],
  exports: [ExposureService],
})
export class ExposureModule {}
