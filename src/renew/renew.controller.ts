import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { GetUserDetailsDto } from './dto/get-user-details.dto';
import { GetUserDetailsResponseDto } from './dto/get-user-details-response.dto';
import { SubmitFormRenewDto } from './dto/submit-form-renew.dto';
import { SubmitFormRenewResponseDto } from './dto/submit-form-renew-response.dto';
import { PaymentSuccessOrDto } from './dto/payment-success-or.dto';
import { PaymentSuccessOrResponseDto } from './dto/payment-success-or-response.dto';
import { RenewService } from './renew.service';

@ApiTags('Renew')
@Controller('renew')
export class RenewController {
  constructor(private readonly renewService: RenewService) {}

  @Public()
  @Post('getUserDetails')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user details by username for renew flow',
    description:
      'Returns renew-eligible user details when username exists and role_id is 4. Eligible cases: account inactive (status 0), or active (status 1) with subscription end (created_at + 1 year) within the next 7 days.',
  })
  @ApiResponse({
    status: 200,
    description: 'Renew user details lookup response',
    type: GetUserDetailsResponseDto,
  })
  async getUserDetails(
    @Body() dto: GetUserDetailsDto,
  ): Promise<GetUserDetailsResponseDto> {
    return this.renewService.getUserDetailsByUsername(dto);
  }

  @Public()
  @Post('submitForm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit mCaMS renewal form',
    description:
      'Creates renewal audit record and updates expired mCaMS user fee/order details for payment gateway flow.',
  })
  @ApiResponse({
    status: 200,
    description: 'Renewal form submission response',
    type: SubmitFormRenewResponseDto,
  })
  async submitForm(
    @Body() dto: SubmitFormRenewDto,
  ): Promise<SubmitFormRenewResponseDto> {
    return this.renewService.submitFormCaMSRenewalNew(dto);
  }

  @Public()
  @Post('paymentSuccessOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process renewal payment success',
    description:
      'Completes renewal payment transaction by activating user, inserting EMD and investment response records.',
  })
  @ApiResponse({
    status: 200,
    description: 'Renew payment success response',
    type: PaymentSuccessOrResponseDto,
  })
  async paymentSuccessOR(
    @Body() dto: PaymentSuccessOrDto,
  ): Promise<PaymentSuccessOrResponseDto> {
    return this.renewService.paymentSuccessOR2(dto);
  }
}
