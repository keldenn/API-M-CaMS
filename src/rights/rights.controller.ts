import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RightsService } from './rights.service';
import { RightsCheckExistResponseDto } from './dto/check-exist-response.dto';
import {
  HandleRightsCallbackDto,
  HandleRightsCallbackResponseDto,
} from './dto/handle-rights-callback.dto';
import {
  SubscribeRightsDto,
  SubscribeRightsResponseDto,
} from './dto/subscribe-rights.dto';

@ApiTags('Rights')
@Controller('rights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RightsController {
  constructor(private readonly rightsService: RightsService) {}

  @Get('check-exist')
  @ApiOperation({
    summary: 'Check if rights exist for authenticated user',
    description:
      'Uses `cd_code` from the JWT access token. Available only during the rights subscription window (7 Jul 2026 5:00 PM – 28 Jul 2026 5:00 PM, Asia/Thimphu). `symbol_id`, `corp_announcement_id`, and related filters are fixed server-side.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rights existence check completed',
    type: RightsCheckExistResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Subscription not yet started or subscription has ended',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async checkExist(@Request() req): Promise<RightsCheckExistResponseDto> {
    try {
      const cdCode = req.user?.cd_code?.trim();

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const data = await this.rightsService.checkRightsExist(cdCode);
      const exists = data.length > 0;

      return {
        error: false,
        message: exists ? 'Rights record found' : 'No rights record found',
        exists,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in rights/check-exist:', error);
      throw new HttpException(
        'Failed to check rights existence',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('subscribeRights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Subscribe to rights issue',
    description:
      'Inserts a pending rights subscription into `rights_issue_online_temp`. Uses `cd_code` from the JWT; `cid`, `email`, and `phone` are resolved from `client_account`. `symbol_id`, `payment_status`, `type`, `AS_Check`, and `client_acc_check` are fixed server-side.',
  })
  @ApiBody({ type: SubscribeRightsDto })
  @ApiResponse({
    status: 200,
    description: 'Rights subscription submitted',
    type: SubscribeRightsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failure or client account not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async subscribeRights(
    @Request() req,
    @Body() dto: SubscribeRightsDto,
  ): Promise<SubscribeRightsResponseDto> {
    try {
      const cdCode = req.user?.cd_code?.trim();

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const insertId = await this.rightsService.subscribeRights({
        cdCode,
        orderNo: dto.order_no,
        amount: dto.amount,
        volApplied: dto.vol_applied,
        price: dto.price,
        details: dto.details,
      });

      return {
        error: false,
        message: 'Rights subscription submitted successfully',
        insert_id: insertId > 0 ? insertId : undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in rights/subscribeRights:', error);
      throw new HttpException(
        'Failed to submit rights subscription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('handleRightsCallback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process rights subscription payment callback',
    description:
      'Completes a rights subscription after payment: updates `rights_issue_online_temp`, upserts `rights_issue`, then sends SMS/email. `email_status` is set to 1 when either notification succeeds. Requires JWT; `cd_code` in the temp record must match the token.',
  })
  @ApiBody({ type: HandleRightsCallbackDto })
  @ApiResponse({
    status: 200,
    description: 'Rights callback processed',
    type: HandleRightsCallbackResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No pending subscription found for order',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'CD code does not match authenticated user',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async handleRightsCallback(
    @Request() req,
    @Body() dto: HandleRightsCallbackDto,
  ): Promise<HandleRightsCallbackResponseDto> {
    try {
      const cdCode = req.user?.cd_code?.trim();

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.rightsService.handleRightsCallback(
        dto.order_no,
        cdCode,
      );

      return {
        error: false,
        message: 'Rights callback processed successfully',
        order_no: result.orderNo,
        order_id: result.orderId > 0 ? result.orderId : undefined,
        email_status: result.emailStatus,
        sms_sent: result.smsSent,
        email_sent: result.emailSent,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in rights/handleRightsCallback:', error);
      throw new HttpException(
        'Failed to process rights callback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
