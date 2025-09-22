import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGlobalGuard } from './auth/guards/jwt-auth-global.guard';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Comment out database connection for now to test the server
    // TypeOrmModule.forRootAsync({
    //   useFactory: getDatabaseConfig,
    //   inject: [ConfigService],
    // }),
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: configService.get('THROTTLE_TTL', 60) * 1000,
          limit: configService.get('THROTTLE_LIMIT', 10),
        },
        {
          name: 'long',
          ttl: configService.get('THROTTLE_TTL', 60) * 1000 * 10,
          limit: configService.get('THROTTLE_LIMIT', 100),
        },
      ],
      inject: [ConfigService],
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGlobalGuard,
    },
  ],
})
export class AppModule {}
