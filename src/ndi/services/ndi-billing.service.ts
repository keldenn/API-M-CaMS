import { Injectable, Logger } from '@nestjs/common';
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
  ) {}

  async submitBill(dto: NdiBillSubmitDto): Promise<NdiBillSubmitResponseDto> {
    const threadId = dto.thread_id.trim();

    const row = this.ndiBillingRepository.create({
      cid: dto.cid.trim(),
      cd_code: dto.cd_code.trim(),
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

    try {
      response.ndi = await this.ndiVerifierService.submitBillSubmitted([
        threadId,
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown NDI error';
      this.logger.error(
        `Local billing saved (id=${saved.id}) but NDI bill-submitted failed: ${message}`,
      );
      response.ndi_error = message;
    }

    return response;
  }
}
