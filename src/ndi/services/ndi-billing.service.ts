import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NdiBilling } from '../../entities/ndi-billing.entity';
import {
  NdiBillSubmitDto,
  NdiBillSubmitResponseDto,
} from '../dto/ndi-bill-submit.dto';
import { NdiVerifierService } from './ndi-verifier.service';

const SERVICE_TYPE = 'mcmas_registration';

@Injectable()
export class NdiBillingService {
  private readonly logger = new Logger(NdiBillingService.name);

  constructor(
    @InjectRepository(NdiBilling, 'cms22')
    private readonly ndiBillingRepository: Repository<NdiBilling>,
    private readonly ndiVerifierService: NdiVerifierService,
    private readonly configService: ConfigService,
  ) {}

  async submitBill(dto: NdiBillSubmitDto): Promise<NdiBillSubmitResponseDto> {
    const threadId = dto.thread_id.trim();
    const cdCode = dto.cd_code.trim();

    const row = this.ndiBillingRepository.create({
      cid: dto.cid.trim(),
      cd_code: cdCode,
      thread_id: threadId,
      order_no: dto.order_no.trim(),
      service_type: SERVICE_TYPE,
    });

    const saved = await this.ndiBillingRepository.save(row);
    this.logger.log(
      `NDI billing record created id=${saved.id} order_no=${saved.order_no}`,
    );

    const response: NdiBillSubmitResponseDto = {
      success: true,
      message: 'Billing record submitted successfully',
      id: saved.id,
    };

    const maxRetries = this.configService.get<number>('ndi.maxRetries', 3);
    const retryDelay = this.configService.get<number>('ndi.retryDelay', 1000);
    const attempts = Math.max(1, maxRetries);
    let lastErrorMessage = 'Unknown NDI error';

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        response.ndi = await this.ndiVerifierService.submitBillSubmitted(
          [threadId],
          cdCode,
        );
        if (attempt > 1) {
          this.logger.log(
            `NDI bill-submitted succeeded on retry attempt=${attempt}/${attempts} billingId=${saved.id}`,
          );
        }
        return response;
      } catch (error) {
        lastErrorMessage =
          error instanceof Error ? error.message : 'Unknown NDI error';
        const isLastAttempt = attempt === attempts;

        this.logger.error(
          `NDI bill-submitted failed attempt=${attempt}/${attempts} billingId=${saved.id} order_no=${saved.order_no} thread_id=${threadId} cd_code=${cdCode}: ${lastErrorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );

        if (!isLastAttempt) {
          const delayMs = retryDelay * attempt;
          this.logger.warn(
            `Retrying NDI bill-submitted in ${delayMs}ms (attempt ${attempt + 1}/${attempts}) billingId=${saved.id}`,
          );
          await this.sleep(delayMs);
        }
      }
    }

    this.logger.error(
      `Local billing saved (id=${saved.id}) but NDI bill-submitted failed after ${attempts} attempts: ${lastErrorMessage}`,
    );
    response.ndi_error = lastErrorMessage;
    return response;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
