import { Module } from '@nestjs/common';
import { UnclaimedController } from './unclaimed.controller';
import { UnclaimedService } from './unclaimed.service';

@Module({
  controllers: [UnclaimedController],
  providers: [UnclaimedService],
})
export class UnclaimedModule {}
