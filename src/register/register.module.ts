import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { ClientAccount } from '../entities/client-account.entity';
import { BboCommission } from '../entities/bbo-commission.entity';
import { ApiOnlineTerminal } from '../entities/api-online-terminal.entity';
import { Emd } from '../entities/emd.entity';
import { InvestmentTempResponse } from '../entities/investment-temp-response.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientAccount, BboCommission], 'default'),
    TypeOrmModule.forFeature(
      [ApiOnlineTerminal, Emd, InvestmentTempResponse],
      'cms22',
    ),
  ],
  controllers: [RegisterController],
  providers: [RegisterService],
  exports: [RegisterService],
})
export class RegisterModule {}
