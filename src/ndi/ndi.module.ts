import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NdiController } from './controllers/ndi.controller';
import { NdiAuthService } from './services/ndi-auth.service';
import { NdiVerifierService } from './services/ndi-verifier.service';
import { NatsService } from './services/nats.service';
import { NdiIntegrationService } from './services/ndi-integration.service';
import { NdiBillingService } from './services/ndi-billing.service';
import { AuthModule } from '../auth/auth.module';
import { NdiBilling } from '../entities/ndi-billing.entity';
import ndiConfig from './config/ndi.config';

@Module({
  imports: [
    ConfigModule.forFeature(ndiConfig),
    AuthModule,
    TypeOrmModule.forFeature([NdiBilling], 'cms22'),
  ],
  controllers: [NdiController],
  providers: [
    NdiAuthService,
    NdiVerifierService,
    NatsService,
    NdiIntegrationService,
    NdiBillingService,
  ],
  exports: [
    NdiAuthService,
    NdiVerifierService,
    NatsService,
    NdiIntegrationService,
    NdiBillingService,
  ],
})
export class NdiModule {}
