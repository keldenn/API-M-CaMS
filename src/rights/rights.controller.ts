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
import { CheckExistRequestDto } from './dto/check-exist-request.dto';
import { ActiveRightsResponseDto } from './dto/active-rights-response.dto';
import { NotifyEligibleRightsResponseDto } from './dto/notify-eligible-response.dto';
import {
  HandleRightsCallbackDto,
  HandleRightsCallbackResponseDto,
} from './dto/handle-rights-callback.dto';
import {
  SubscribeRightsDto,
  SubscribeRightsResponseDto,
} from './dto/subscribe-rights.dto';
import {
  SubscribeRenounceDto,
  SubscribeRenounceResponseDto,
} from './dto/subscribe-renounce.dto';

@ApiTags('Rights')
@Controller('rights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RightsController {
  constructor(private readonly rightsService: RightsService) {}

  @Post('check-exist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if rights exist for authenticated user',
    description:
      'Uses `cd_code` from the JWT access token. `symbol_id` and `corp_announcement_id` are provided in the request body.',
  })
  @ApiBody({ type: CheckExistRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Rights existence check completed',
    type: RightsCheckExistResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failure - invalid request body',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async checkExist(
    @Request() req,
    @Body() dto: CheckExistRequestDto,
  ): Promise<RightsCheckExistResponseDto> {
    try {
      const cdCode = req.user?.cd_code?.trim();

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const data = await this.rightsService.checkRightsExist(
        cdCode,
        dto.symbol_id,
        dto.corp_announcement_id,
      );
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

  @Get('active')
  @ApiOperation({
    summary: 'Get active rights offers',
    description:
      'Returns rows from `rights_offers` where `status = 1` and `end_at` is not in the past.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active rights offers retrieved successfully',
    type: ActiveRightsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getActiveRights(): Promise<ActiveRightsResponseDto> {
    try {
      const data = await this.rightsService.getActiveRightsOffers();

      return {
        error: false,
        message:
          data.length > 0
            ? 'Active rights offers retrieved successfully'
            : 'No active rights offers found',
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in rights/active:', error);
      throw new HttpException(
        'Failed to fetch active rights offers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('notify-eligible')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Notify all eligible clients for a rights offer',
    description:
      'Finds all clients eligible for the given `symbol_id` and `corp_announcement_id` (same eligibility rules as check-exist, without cd_code), then sends an FCM push to each client that has a registered token. Clients without tokens are skipped. Does not return the client list.',
  })
  @ApiBody({ type: CheckExistRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Rights offer notifications processed',
    type: NotifyEligibleRightsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failure - invalid request body',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async notifyEligible(
    @Body() dto: CheckExistRequestDto,
  ): Promise<NotifyEligibleRightsResponseDto> {
    try {
      const result = await this.rightsService.notifyEligibleRightsClients(
        dto.symbol_id,
        dto.corp_announcement_id,
      );

      return {
        error: false,
        message:
          result.eligible_count > 0
            ? 'Rights offer notifications processed successfully'
            : 'No eligible clients found for this rights offer',
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in rights/notify-eligible:', error);
      throw new HttpException(
        'Failed to notify eligible rights clients',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('subscribeRights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Subscribe to rights issue',
    description:
      'Inserts a pending rights subscription into `rights_issue_online_temp`. Uses `cd_code` from the JWT; `symbol_id` from the request body; `cid`, `email`, and `phone` are resolved from `client_account`. `payment_status`, `type`, `AS_Check`, and `client_acc_check` are fixed server-side.',
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
        symbolId: dto.symbol_id,
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

  @Post('subscribeRenounce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process rights renounce payment callback',
    description:
      'Same flow as `handleRightsCallback`: updates `rights_issue_online_temp`, upserts `rights_issue` with `type = R` and `renounce_cd_code` from the body, then sends SMS/email. Requires JWT; `cd_code` in the temp record must match the token.',
  })
  @ApiBody({ type: SubscribeRenounceDto })
  @ApiResponse({
    status: 200,
    description: 'Rights renounce processed',
    type: SubscribeRenounceResponseDto,
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
  async subscribeRenounce(
    @Request() req,
    @Body() dto: SubscribeRenounceDto,
  ): Promise<SubscribeRenounceResponseDto> {
    try {
      const cdCode = req.user?.cd_code?.trim();

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.rightsService.subscribeRenounce(
        dto.order_no,
        cdCode,
        dto.renounce_cd_code,
      );

      return {
        error: false,
        message: 'Rights renounce processed successfully',
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

      console.error('Error in rights/subscribeRenounce:', error);
      throw new HttpException(
        'Failed to process rights renounce',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
