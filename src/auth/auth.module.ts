import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthServiceMock } from './auth.service.mock';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { User } from '../entities/user.entity';
import { LinkUser } from '../entities/linkuser.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';
import { MobileApiLog } from '../entities/mobile-api-log.entity';

@Module({
  imports: [
    // Comment out database entities for now
    // TypeOrmModule.forFeature([User, LinkUser, LoginAttempt, MobileApiLog]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Use mock service for now (no database required)
    { provide: AuthService, useClass: AuthServiceMock },
    JwtStrategy, 
    LocalStrategy
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

