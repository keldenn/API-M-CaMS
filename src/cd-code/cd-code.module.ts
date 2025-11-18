import { Module } from '@nestjs/common';
import { CdCodeController } from './cd-code.controller';
import { CdCodeService } from './cd-code.service';

@Module({
  controllers: [CdCodeController],
  providers: [CdCodeService],
})
export class CdCodeModule {}

