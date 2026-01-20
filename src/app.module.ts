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
import { CdCodeModule } from './cd-code/cd-code.module';
import { OrdersModule } from './orders/orders.module';
import { CompanyModule } from './company/company.module';
import { FcmModule } from './fcm/fcm.module';
import {
  getDatabaseConfig,
  getFinancialDatabaseConfig,
  getCms22DatabaseConfig,
} from './config/database.config';
import { JwtAuthGlobalGuard } from './auth/guards/jwt-auth-global.guard';

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
    CdCodeModule,
    OrdersModule,
    CompanyModule,
    FcmModule,
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
