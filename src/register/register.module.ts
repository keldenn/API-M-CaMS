import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { ClientAccount } from '../entities/client-account.entity';
import { BboCommission } from '../entities/bbo-commission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientAccount, BboCommission], 'default'),
  ],
  controllers: [RegisterController],
  providers: [RegisterService],
  exports: [RegisterService],
})
export class RegisterModule {}

