import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NdiAuthService } from './ndi-auth.service';
import {
  NdiProofPurpose,
  NdiProofRequestDto,
  NdiProofResponseDto,
} from '../dto/ndi-auth.dto';
import { NdiBillSubmittedApiResponseDto } from '../dto/ndi-bill-submit.dto';
import {
  ADDRESS_SCHEMA_FALLBACK,
  DEFAULT_PROOF_NAME,
  IDENTITY_SCHEMA_FALLBACK,
  SUPPORTED_ATTRIBUTES,
  buildProofAttributes,
  canonicalizeAttributeName,
  schemaForAttribute,
} from '../constants/ndi-schemas';

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

  /**
   * Attributes requested when the caller does not supply its own list.
   * Foundational ID attributes come from schema 1, address attributes from schema 2.
   */
  getDefaultProofAttributes(): Array<{ name: string; schemaName: string }> {
    return buildProofAttributes(
      this.getIdentitySchema(),
      this.getAddressSchema(),
    );
  }

  private getIdentitySchema(): string {
    return this.configService.get<string>(
      'ndi.defaultSchema',
      IDENTITY_SCHEMA_FALLBACK,
    );
  }

  private getAddressSchema(): string {
    return this.configService.get<string>(
      'ndi.addressSchema',
      ADDRESS_SCHEMA_FALLBACK,
    );
  }

  /**
   * Fills in the schema URL for attributes sent without one, using the
   * configured identity/address schemas. An explicit schemaName wins.
   */
  private resolveAttributeSchemas(
    attributes: Array<{ name: string; schemaName?: string }>,
  ): Array<{ name: string; schemaName: string }> {
    const identitySchema = this.getIdentitySchema();
    const addressSchema = this.getAddressSchema();

    return attributes.map((attr) => {
      const canonicalName = canonicalizeAttributeName(attr.name);

      if (attr.schemaName) {
        return { name: canonicalName ?? attr.name, schemaName: attr.schemaName };
      }

      if (!canonicalName) {
        throw new HttpException(
          `Unknown NDI attribute "${attr.name}". Supported attributes: ${SUPPORTED_ATTRIBUTES.join(', ')}. Provide schemaName explicitly to request a custom attribute.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const schemaName = schemaForAttribute(
        canonicalName,
        identitySchema,
        addressSchema,
      );

      if (!schemaName) {
        throw new HttpException(
          `No schema configured for NDI attribute "${canonicalName}".`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return { name: canonicalName, schemaName };
    });
  }

  async createFoundationalIdProofRequest(
    proofName = DEFAULT_PROOF_NAME,
    purpose: NdiProofPurpose = NdiProofPurpose.EKYC,
  ): Promise<NdiProofResponseDto> {
    return this.createCustomProofRequest(
      proofName,
      this.getDefaultProofAttributes(),
      purpose,
    );
  }

  async createCustomProofRequest(
    proofName: string,
    attributes: Array<{ name: string; schemaName?: string }>,
    purpose: NdiProofPurpose = NdiProofPurpose.EKYC,
  ): Promise<NdiProofResponseDto> {
    const proofRequest: NdiProofRequestDto = {
      proofName,
      proofAttributes: this.resolveAttributeSchemas(attributes).map((attr) => ({
        name: attr.name,
        restrictions: [
          {
            schema_name: attr.schemaName,
          },
        ],
      })),
      purpose,
    };

    return this.createProofRequest(proofRequest);
  }

  async submitBillSubmitted(
    threadIds: string[],
    flowId: string,
  ): Promise<NdiBillSubmittedApiResponseDto> {
    try {
      this.logger.log(
        `Submitting bill to NDI for flowId=${flowId} threadIds: ${threadIds.join(', ')}`,
      );

      const accessToken =
        await this.ndiAuthService.getValidAccessTokenForStaging();
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
        flowId,
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
      const status = error.response?.status;
      const responseBody = error.response?.data
        ? JSON.stringify(error.response.data)
        : undefined;

      this.logger.error(
        `NDI bill-submitted request failed flowId=${flowId} status=${status ?? 'n/a'} message=${error.message}${responseBody ? ` body=${responseBody}` : ''}`,
        error.stack,
      );

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
