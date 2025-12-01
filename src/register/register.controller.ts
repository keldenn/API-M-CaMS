import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterService } from './register.service';
import { RegisterCdCodeDto } from './dto/register-cd-code.dto';
import { RegisterCdCodeResponseDto } from './dto/register-cd-code-response.dto';
import { SubmitUserDetailsDto } from './dto/submit-user-details.dto';
import { PaymentSuccessOtDto } from './dto/payment-success-ot.dto';
import { RegisterMcamsDto } from './dto/register-mcams.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Register')
@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Public()
  @Post('cd_code')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register client account with CD code',
    description: 'Creates a new client account with CD code generation. Validates ID, checks for duplicates, and generates unique CD code based on broker prefix.',
  })
  @ApiResponse({
    status: 201,
    description: 'Client account created successfully',
    type: RegisterCdCodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - CID or CD Code already exists',
  })
  async registerCdCode(@Body() registerDto: RegisterCdCodeDto): Promise<RegisterCdCodeResponseDto> {
    return this.registerService.registerCdCode(registerDto);
  }

  @Public()
  @Post('submit-user-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit user details for mCaMS registration',
    description: 'Submits user details before payment processing. Creates a record in api_online_terminal table.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application submitted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed or submission error',
  })
  async submitUserDetails(@Body() dto: SubmitUserDetailsDto) {
    return this.registerService.submitUserDetails(dto);
  }

  @Public()
  @Post('payment-success-ot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process payment success for mCaMS registration',
    description: 'Updates fee_status, inserts into emd and investment_temp_response tables after successful payment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Transaction failed',
  })
  async paymentSuccessOT(@Body() dto: PaymentSuccessOtDto) {
    return this.registerService.paymentSuccessOT(dto);
  }

  @Public()
  @Post('mcams')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Combined mCaMS registration (CD code + payment)',
    description: 'Registers client account with CD code and processes payment in a single transaction. Both operations must succeed or both fail.',
  })
  @ApiResponse({
    status: 200,
    description: 'mCaMS registration completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Registration failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - CID or CD Code already exists',
  })
  async registerMcams(@Body() dto: RegisterMcamsDto) {
    return this.registerService.registerMcams(dto);
  }
}

