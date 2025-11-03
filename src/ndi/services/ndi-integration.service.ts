import { Injectable, Logger } from '@nestjs/common';
import { NdiAuthService } from './ndi-auth.service';
import { NdiVerifierService } from './ndi-verifier.service';
import { NatsService } from './nats.service';
import { NdiProofResponseDto, NdiProofResultDto } from '../dto/ndi-auth.dto';

@Injectable()
export class NdiIntegrationService {
  private readonly logger = new Logger(NdiIntegrationService.name);

  // In-memory storage for verification results (threadId -> result)
  private readonly verificationResults = new Map<string, NdiProofResultDto>();

  constructor(
    private readonly ndiAuthService: NdiAuthService,
    private readonly ndiVerifierService: NdiVerifierService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Complete workflow for NDI verification
   * 1. Authenticate with NDI
   * 2. Create proof request
   * 3. Subscribe to NATS for results
   * 4. Return deep link for user interaction
   */
  async initiateVerificationWorkflow(
    proofName: string = 'Verify Foundational ID',
    attributes?: Array<{ name: string; schemaName: string }>,
  ): Promise<{
    proofRequest: NdiProofResponseDto;
    deepLinkUrl: string;
    qrCodeUrl: string;
    threadId: string;
  }> {
    try {
      this.logger.log('Initiating NDI verification workflow...');

      // Step 1: Ensure we have a valid access token
      await this.ndiAuthService.getValidAccessToken();

      // Step 2: Create proof request
      let proofRequest: NdiProofResponseDto;

      if (attributes && attributes.length > 0) {
        proofRequest = await this.ndiVerifierService.createCustomProofRequest(
          proofName,
          attributes,
        );
      } else {
        proofRequest =
          await this.ndiVerifierService.createFoundationalIdProofRequest();
      }

      // Step 3: Subscribe to NATS for proof results (if NATS is available)
      try {
        await this.subscribeToProofResult(
          proofRequest.data.proofRequestThreadId,
        );
      } catch (error) {
        this.logger.warn(
          'NATS subscription failed, but verification workflow will continue:',
          error.message,
        );
      }

      this.logger.log('NDI verification workflow initiated successfully');

      return {
        proofRequest,
        deepLinkUrl: proofRequest.data.deepLinkURL,
        qrCodeUrl: proofRequest.data.proofRequestURL,
        threadId: proofRequest.data.proofRequestThreadId,
      };
    } catch (error) {
      this.logger.error(
        'Failed to initiate verification workflow:',
        error.message,
      );
      throw error;
    }
  }

  /**
   * Subscribe to proof result and set up callback
   */
  private async subscribeToProofResult(threadId: string): Promise<void> {
    const callback = (result: NdiProofResultDto) => {
      this.handleProofResult(result);
    };

    await this.natsService.subscribeToProofResult(threadId, callback);
  }

  /**
   * Handle proof result when received via NATS
   */
  private async handleProofResult(result: NdiProofResultDto): Promise<void> {
    // Store the result in memory for status queries
    this.verificationResults.set(result.threadId, result);

    // Log the result in the exact JSON format requested
    this.logger.log('=== NDI PROOF RESULT ===');
    this.logger.log(JSON.stringify(result, null, 2));
    this.logger.log('========================');

    try {
      const normalizedStatus = (result?.status ?? 'pending')
        .toString()
        .toLowerCase();
      // Process the proof result based on status
      switch (normalizedStatus) {
        case 'verified':
        case 'accepted':
          await this.handleSuccessfulVerification(result);
          break;
        case 'rejected':
        case 'declined':
          await this.handleRejectedVerification(result);
          break;
        case 'expired':
          await this.handleExpiredVerification(result);
          break;
        default:
          this.logger.warn(`Unknown proof result status: ${result?.status}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling proof result for thread ${result.threadId}:`,
        error.message,
      );
    }
  }

  /**
   * Handle successful verification
   */
  private async handleSuccessfulVerification(
    result: NdiProofResultDto,
  ): Promise<void> {
    this.logger.log(`Verification successful for thread ${result.threadId}`);

    // Here you can:
    // 1. Save verification result to database
    // 2. Update user status
    // 3. Send notifications
    // 4. Trigger business logic

    // Example: Log the verified attributes
    if (result.proofData) {
      this.logger.log('Verified attributes:', result.proofData);
    }
  }

  /**
   * Handle rejected verification
   */
  private async handleRejectedVerification(
    result: NdiProofResultDto,
  ): Promise<void> {
    this.logger.log(`Verification rejected for thread ${result.threadId}`);

    // Here you can:
    // 1. Log the rejection reason
    // 2. Update user status
    // 3. Send notification to user
    // 4. Clean up any pending processes
  }

  /**
   * Handle expired verification
   */
  private async handleExpiredVerification(
    result: NdiProofResultDto,
  ): Promise<void> {
    this.logger.log(`Verification expired for thread ${result.threadId}`);

    // Here you can:
    // 1. Clean up expired verification
    // 2. Notify user to retry
    // 3. Update verification status
  }

  /**
   * Get verification status for a thread
   */
  async getVerificationStatus(threadId: string): Promise<{
    threadId: string;
    status: string;
    proofData?: any;
    timestamp?: string;
  }> {
    const result = this.verificationResults.get(threadId);

    if (result) {
      // Return the stored result
      return {
        threadId: result.threadId,
        status: result.status,
        proofData: result.proofData,
        timestamp: result.timestamp,
      };
    }

    // No result found, still pending
    return {
      threadId,
      status: 'pending',
    };
  }

  /**
   * Clean up verification resources
   */
  async cleanupVerification(threadId: string): Promise<void> {
    try {
      await this.natsService.unsubscribeFromProofResult(threadId);
      this.logger.log(
        `Cleaned up verification resources for thread ${threadId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error cleaning up verification for thread ${threadId}:`,
        error.message,
      );
    }
  }
}
