import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NdiController } from './controllers/ndi.controller';
import { NdiAuthService } from './services/ndi-auth.service';
import { NdiVerifierService } from './services/ndi-verifier.service';
import { NatsService } from './services/nats.service';
import { NdiIntegrationService } from './services/ndi-integration.service';
import { AuthModule } from '../auth/auth.module';
import ndiConfig from './config/ndi.config';

@Module({
  imports: [ConfigModule.forFeature(ndiConfig), AuthModule],
  controllers: [NdiController],
  providers: [
    NdiAuthService,
    NdiVerifierService,
    NatsService,
    NdiIntegrationService,
  ],
  exports: [
    NdiAuthService,
    NdiVerifierService,
    NatsService,
    NdiIntegrationService,
  ],
})
export class NdiModule {}
