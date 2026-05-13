import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McamsWallet } from '../entities/mcams-wallet.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([McamsWallet], 'cms22')],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
