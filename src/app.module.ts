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
import { getDatabaseConfig, getFinancialDatabaseConfig } from './config/database.config';
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
    AuthModule,
    OtpModule,
    NdiModule,
    HoldingsModule,
    StocksModule,
    MarketDataModule,
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
