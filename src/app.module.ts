import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OtpModule } from './otp/otp.module';
import { NdiModule } from './ndi/ndi.module';
import { HoldingsModule } from './holdings/holdings.module';
import { StocksModule } from './stocks/stocks.module';
import { MarketDataModule } from './market-data/market-data.module';
import { CorporateActionsModule } from './corporate-actions/corporate-actions.module';
import { RegisterModule } from './register/register.module';
import { RenewModule } from './renew/renew.module';
import { CdCodeModule } from './cd-code/cd-code.module';
import { BrokersModule } from './brokers/brokers.module';
import { OrdersModule } from './orders/orders.module';
import { CompanyModule } from './company/company.module';
import { FcmModule } from './fcm/fcm.module';
import { WalletModule } from './wallet/wallet.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { ProfileModule } from './profile/profile.module';
import {
  getDatabaseConfig,
  getFinancialDatabaseConfig,
  getCms22DatabaseConfig,
} from './config/database.config';
import { JwtAuthGlobalGuard } from './auth/guards/jwt-auth-global.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountExpiryFcmModule } from './account-expiry-fcm/account-expiry-fcm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      name: 'default',
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: 'financial',
      useFactory: getFinancialDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: 'cms22',
      useFactory: getCms22DatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    OtpModule,
    NdiModule,
    HoldingsModule,
    StocksModule,
    MarketDataModule,
    CorporateActionsModule,
    RegisterModule,
    RenewModule,
    CdCodeModule,
    BrokersModule,
    OrdersModule,
    CompanyModule,
    FcmModule,
    WalletModule,
    WatchlistModule,
    ProfileModule,
    ScheduleModule.forRoot(),
    AccountExpiryFcmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGlobalGuard,
    },
  ],
})
export class AppModule {}
