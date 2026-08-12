import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NdiAuthService } from './ndi-auth.service';
import { NdiProofRequestDto, NdiProofResponseDto } from '../dto/ndi-auth.dto';
import { NdiBillSubmittedApiResponseDto } from '../dto/ndi-bill-submit.dto';

const BILL_FLOW_ID = 'mcmas_registration';

@Injectable()
export class NdiVerifierService {
  private readonly logger = new Logger(NdiVerifierService.name);
  private readonly verifierUrl: string;

  constructor(
    private configService: ConfigService,
    private ndiAuthService: NdiAuthService,
  ) {
    this.verifierUrl = this.configService.get<string>(
      'ndi.verifierUrl',
      'https://app.rsebl.org.bt/verifier/v1/proof-request',
    );
  }

  async createProofRequest(
    proofRequest: NdiProofRequestDto,
  ): Promise<NdiProofResponseDto> {
    try {
      this.logger.log('Creating proof request...');

      // Get fresh access token for this request
      const accessToken = await this.ndiAuthService.getValidAccessToken();

      const response = await axios.post(this.verifierUrl, proofRequest, {
        headers: {
          'Content-Type': 'application/json',
          accept: '*/*',
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 30000,
      });

      if (response.status === 201) {
        this.logger.log('Proof request created successfully');
        return response.data;
      }

      throw new HttpException(
        'Proof request creation failed',
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      this.logger.error('Proof request creation failed:', error.message);

      if (error.response) {
        throw new HttpException(
          `Proof request creation failed: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'NDI Verifier service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async createFoundationalIdProofRequest(): Promise<NdiProofResponseDto> {
    const proofRequest: NdiProofRequestDto = {
      proofName: 'Verify Foundational ID',
      proofAttributes: [
        {
          name: 'ID Number',
          restrictions: [
            {
              schema_name: this.configService.get<string>(
                'ndi.defaultSchema',
                'https://schema.ngotag.com/schemas/fb675203-b317-4675-a657-be7f5d1d57fb',
              ),
            },
          ],
        },
      ],
    };

    return this.createProofRequest(proofRequest);
  }

  async createCustomProofRequest(
    proofName: string,
    attributes: Array<{ name: string; schemaName: string }>,
  ): Promise<NdiProofResponseDto> {
    const proofRequest: NdiProofRequestDto = {
      proofName,
      proofAttributes: attributes.map((attr) => ({
        name: attr.name,
        restrictions: [
          {
            schema_name: attr.schemaName,
          },
        ],
      })),
    };

    return this.createProofRequest(proofRequest);
  }

  async submitBillSubmitted(
    threadIds: string[],
  ): Promise<NdiBillSubmittedApiResponseDto> {
    try {
      this.logger.log(
        `Submitting bill to NDI for threadIds: ${threadIds.join(', ')}`,
      );

      const accessToken = await this.ndiAuthService.getValidAccessToken();
      const billSubmittedUrl = this.configService.get<string>(
        'ndi.billSubmittedUrl',
      );
      if (!billSubmittedUrl) {
        throw new HttpException(
          'NDI_BILL_SUBMITTED_URL is not configured',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const payload = {
        flowId: BILL_FLOW_ID,
        threadIds,
        purpose: 'ekyc',
      };

      const response = await axios.post(billSubmittedUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          accept: '*/*',
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: this.configService.get<number>('ndi.requestTimeout', 30000),
      });

      if (response.status === 200 || response.status === 201) {
        this.logger.log('NDI bill-submitted call succeeded');
        return response.data;
      }

      throw new HttpException(
        'NDI bill-submitted request failed',
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      this.logger.error('NDI bill-submitted request failed:', error.message);

      if (error.response) {
        throw new HttpException(
          `NDI bill-submitted failed: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'NDI bill-submitted service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
