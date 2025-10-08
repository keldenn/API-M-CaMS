import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  HttpCode, 
  HttpStatus, 
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NdiAuthService } from '../services/ndi-auth.service';
import { NdiVerifierService } from '../services/ndi-verifier.service';
import { NatsService } from '../services/nats.service';
import { NdiIntegrationService } from '../services/ndi-integration.service';
import { 
  NdiAuthRequestDto, 
  NdiAuthResponseDto, 
  NdiProofRequestDto, 
  NdiProofResponseDto,
  NdiProofResultDto,
  NdiVerificationInitiateDto,
  NdiVerificationResponseDto
} from '../dto/ndi-auth.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('NDI Verifier')
@Controller('ndi')
export class NdiController {
  private readonly logger = new Logger(NdiController.name);

  constructor(
    private readonly ndiAuthService: NdiAuthService,
    private readonly ndiVerifierService: NdiVerifierService,
    private readonly natsService: NatsService,
    private readonly ndiIntegrationService: NdiIntegrationService,
  ) {}

  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with NDI OAuth 2.0' })
  @ApiResponse({ 
    status: 200, 
    description: 'Successfully authenticated',
    type: NdiAuthResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication failed' 
  })
  async authenticate(@Body() authRequest: NdiAuthRequestDto): Promise<NdiAuthResponseDto> {
    this.logger.log('NDI authentication request received');
    return this.ndiAuthService.authenticate(authRequest.client_id, authRequest.client_secret);
  }

  @Post('proof-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a proof request (Public)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Proof request created successfully',
    type: NdiProofResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid proof request' 
  })
  async createProofRequest(@Body() proofRequest: NdiProofRequestDto): Promise<NdiProofResponseDto> {
    this.logger.log('Proof request creation initiated');
    return this.ndiVerifierService.createProofRequest(proofRequest);
  }

  @Post('proof-request/foundational-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a foundational ID proof request (Public)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Foundational ID proof request created successfully',
    type: NdiProofResponseDto 
  })
  async createFoundationalIdProofRequest(): Promise<NdiProofResponseDto> {
    this.logger.log('Foundational ID proof request creation initiated');
    return this.ndiVerifierService.createFoundationalIdProofRequest();
  }

  @Post('proof-request/custom')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom proof request (Public)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Custom proof request created successfully',
    type: NdiProofResponseDto 
  })
  async createCustomProofRequest(
    @Body() body: { 
      proofName: string; 
      attributes: Array<{ name: string; schemaName: string }> 
    }
  ): Promise<NdiProofResponseDto> {
    this.logger.log('Custom proof request creation initiated');
    return this.ndiVerifierService.createCustomProofRequest(body.proofName, body.attributes);
  }

  @Post('proof-result/subscribe/:threadId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to proof result via NATS (Public)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Successfully subscribed to proof result' 
  })
  async subscribeToProofResult(@Param('threadId') threadId: string): Promise<{ message: string; threadId: string }> {
    this.logger.log(`Subscribing to proof result for thread: ${threadId}`);
    
    // Set up callback to handle proof results
    const callback = (result: NdiProofResultDto) => {
      this.logger.log(`Proof result received for thread ${threadId}:`, result);
      // Here you can add additional processing like saving to database, 
      // sending notifications, etc.
    };

    await this.natsService.subscribeToProofResult(threadId, callback);
    
    return {
      message: 'Successfully subscribed to proof result',
      threadId,
    };
  }

  @Post('proof-result/unsubscribe/:threadId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from proof result (Public)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Successfully unsubscribed from proof result' 
  })
  async unsubscribeFromProofResult(@Param('threadId') threadId: string): Promise<{ message: string; threadId: string }> {
    this.logger.log(`Unsubscribing from proof result for thread: ${threadId}`);
    
    await this.natsService.unsubscribeFromProofResult(threadId);
    
    return {
      message: 'Successfully unsubscribed from proof result',
      threadId,
    };
  }

  @Get('nats/status')
  @ApiOperation({ summary: 'Get NATS connection status (Public)' })
  @ApiResponse({ 
    status: 200, 
    description: 'NATS connection status retrieved' 
  })
  async getNatsStatus(): Promise<{ status: string; connected: boolean }> {
    return {
      status: this.natsService.getConnectionStatus(),
      connected: this.natsService.isConnected(),
    };
  }

  @Get('auth/status')
  @ApiOperation({ summary: 'Get NDI authentication status (Public)' })
  @ApiResponse({ 
    status: 200, 
    description: 'NDI authentication status retrieved' 
  })
  async getAuthStatus(): Promise<{ authenticated: boolean; tokenValid: boolean }> {
    return {
      authenticated: this.ndiAuthService.isTokenValid(),
      tokenValid: this.ndiAuthService.isTokenValid(),
    };
  }

  @Post('verification/initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate complete NDI verification workflow (Public)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Verification workflow initiated successfully',
    type: NdiVerificationResponseDto
  })
  async initiateVerificationWorkflow(
    @Body() body: NdiVerificationInitiateDto = {}
  ): Promise<NdiVerificationResponseDto> {
    this.logger.log('Initiating complete verification workflow');
    return this.ndiIntegrationService.initiateVerificationWorkflow(
      body.proofName,
      body.attributes,
    );
  }

  @Get('verification/status/:threadId')
  @ApiOperation({ summary: 'Get verification status for a thread (Public)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification status retrieved' 
  })
  async getVerificationStatus(@Param('threadId') threadId: string): Promise<{ threadId: string; status: string }> {
    return this.ndiIntegrationService.getVerificationStatus(threadId);
  }

  @Post('verification/cleanup/:threadId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up verification resources (Public)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification resources cleaned up successfully' 
  })
  async cleanupVerification(@Param('threadId') threadId: string): Promise<{ message: string; threadId: string }> {
    await this.ndiIntegrationService.cleanupVerification(threadId);
    return {
      message: 'Verification resources cleaned up successfully',
      threadId,
    };
  }

}
