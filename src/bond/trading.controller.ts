import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BondDetailsResponseDto } from './dto/bond-details-response.dto';
import { BondBuyRequestDto, BondBuyResponseDto } from './dto/bond-buy.dto';
import { BondSellRequestDto } from './dto/bond-sell.dto';
import {
  BondPendingOrdersResponseDto,
} from './dto/bond-pending-order.dto';
import {
  BondUpdateOrderRequestDto,
  BondUpdateOrderResponseDto,
} from './dto/bond-update-order.dto';
import {
  BondCancelOrderRequestDto,
  BondCancelOrderResponseDto,
} from './dto/bond-cancel-order.dto';
import { BondVolRequestDto, BondVolResponseDto } from './dto/bond-vol.dto';
import { BondYtmRequestDto, BondYtmResponseDto } from './dto/bond-ytm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SecurityTypeResponseDto } from './dto/security-type-response.dto';
import { BondTradingService } from './trading.service';
import { SymbolResponseDto } from './dto/symbol-response.dto';

@ApiTags('Bond')
@Controller('bond/trading')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BondTradingController {
  constructor(private readonly bondTradingService: BondTradingService) {}

  @Get('security_type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List active security types',
    description:
      'Returns active security types from security_type_masters, excluding OS.',
  })
  @ApiOkResponse({
    description: 'Security types retrieved successfully',
    type: SecurityTypeResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getSecurityTypes(): Promise<SecurityTypeResponseDto[]> {
    return this.bondTradingService.getSecurityTypes();
  }

  @Get('symbols')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List active symbols by security type',
    description:
      'Returns active symbols where status = 1 and trsstatus = 1 for a given security_type.',
  })
  @ApiOkResponse({
    description: 'Symbols retrieved successfully',
    type: SymbolResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getSymbols(
    @Query('security_type') securityType: string,
  ): Promise<SymbolResponseDto[]> {
    return this.bondTradingService.getSymbols(securityType);
  }

  @Get('bond_details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get bond details by symbol id',
    description:
      'Returns maturity date, face value and coupon rates from symbol for the given symbol_id.',
  })
  @ApiOkResponse({
    description: 'Bond details retrieved successfully',
    type: BondDetailsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getBondDetails(
    @Query('symbol_id') symbolId: number,
  ): Promise<BondDetailsResponseDto | null> {
    return this.bondTradingService.getBondDetails(Number(symbolId));
  }

  @Post('vol')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get total holding volume',
    description:
      'Returns total holding volume from cds_holding (not free volume). Sell validation is server-side using volume - pending_out_vol.',
  })
  @ApiBody({ type: BondVolRequestDto })
  @ApiOkResponse({
    description: 'Holding volume retrieved successfully',
    type: BondVolResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'cd_code or symbol_id missing/invalid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'CD code does not match authenticated user',
  })
  async getVolume(
    @Request() req: { user?: { cd_code?: string } },
    @Body() dto: BondVolRequestDto,
  ): Promise<BondVolResponseDto> {
    const cdCode = this.resolveCdCodeFromPostBody(req.user, dto.cd_code);
    return this.bondTradingService.getHoldingVolume(dto.symbol_id, cdCode);
  }

  @Post('ytm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate YTM, accrued interest, and dirty price',
    description:
      'Computes coupon timeline, accrued interest, dirty price, annualized YTM (binary search), and broker commission for the provided bond.',
  })
  @ApiBody({ type: BondYtmRequestDto })
  @ApiOkResponse({
    description: 'YTM and pricing metrics calculated successfully',
    type: BondYtmResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or bond pricing data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  @ApiResponse({ status: 403, description: 'CD code does not match authenticated user' })
  @ApiResponse({ status: 404, description: 'Bond symbol not found' })
  async getYtm(
    @Request() req: { user?: { cd_code?: string } },
    @Body() dto: BondYtmRequestDto,
  ): Promise<BondYtmResponseDto> {
    const cdCode = this.resolveCdCodeFromPostBody(req.user, dto.cd_code);
    return this.bondTradingService.calculateYtm({ ...dto, cd_code: cdCode });
  }

  @Post('buy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Place bond buy order',
    description:
      'Places a BUY order. `cd_code`, `order_entry` (username), and `participant_code` (first 7 chars of username) are taken from the JWT access token. `order_type` is set server-side to `OTC`.',
  })
  @ApiBody({ type: BondBuyRequestDto })
  @ApiOkResponse({
    description: 'Bond buy order placed successfully',
    type: BondBuyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or business rule failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  async buy(
    @Request() req: { user?: { cd_code?: string; username?: string } },
    @Body() dto: BondBuyRequestDto,
  ): Promise<BondBuyResponseDto> {
    const { cd_code, order_entry, participant_code } =
      this.resolveBondOrderContextFromJwt(req.user);
    return this.bondTradingService.placeBuyOrder({
      ...dto,
      cd_code,
      order_entry,
      participant_code,
      order_type: 'OTC',
    });
  }

  @Post('sell')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Place bond sell order',
    description:
      'Places a SELL order. `cd_code`, `order_entry` (username), and `participant_code` (first 7 chars of username) are taken from the JWT access token. `order_type` is set server-side to `OTC`. Free volume is validated as `volume - pending_out_vol`.',
  })
  @ApiBody({ type: BondSellRequestDto })
  @ApiOkResponse({
    description: 'Bond sell order placed successfully',
    type: BondBuyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or business rule failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  async sell(
    @Request() req: { user?: { cd_code?: string; username?: string } },
    @Body() dto: BondSellRequestDto,
  ): Promise<BondBuyResponseDto> {
    const { cd_code, order_entry, participant_code } =
      this.resolveBondOrderContextFromJwt(req.user);
    return this.bondTradingService.placeSellOrder({
      ...dto,
      cd_code,
      order_entry,
      participant_code,
      order_type: 'OTC',
    });
  }

  @Get('pending_orders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List pending bond orders',
    description:
      'Returns all pending bond orders for the authenticated user using `cd_code` from the JWT access token.',
  })
  @ApiOkResponse({
    description: 'Pending bond orders retrieved successfully',
    type: BondPendingOrdersResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  async getPendingOrders(
    @Request() req: { user?: { cd_code?: string } },
  ): Promise<BondPendingOrdersResponseDto> {
    const cd_code = this.resolveCdCodeFromJwt(req.user);
    return this.bondTradingService.getPendingOrders(cd_code);
  }

  @Post('update_order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a pending bond order',
    description:
      'Updates price/volume and re-reserves cash (buy) or shares (sell). Body fields match pending order row plus new pricing.',
  })
  @ApiBody({ type: BondUpdateOrderRequestDto })
  @ApiOkResponse({
    description: 'Bond order updated successfully',
    type: BondUpdateOrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or business rule failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrder(
    @Request() req: { user?: { cd_code?: string } },
    @Body() dto: BondUpdateOrderRequestDto,
  ): Promise<BondUpdateOrderResponseDto> {
    const cd_code = this.resolveCdCodeFromJwt(req.user);
    return this.bondTradingService.updateBondOrder(cd_code, dto);
  }

  @Post('cancel_order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a pending bond order',
    description:
      'Cancels a pending bond order using identifiers from the pending orders list. Releases sell reservations and removes finance hold.',
  })
  @ApiBody({ type: BondCancelOrderRequestDto })
  @ApiOkResponse({
    description: 'Bond order cancelled successfully',
    type: BondCancelOrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or business rule failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Request() req: { user?: { cd_code?: string } },
    @Body() dto: BondCancelOrderRequestDto,
  ): Promise<BondCancelOrderResponseDto> {
    const cd_code = this.resolveCdCodeFromJwt(req.user);
    return this.bondTradingService.cancelBondOrder(cd_code, dto);
  }

  /**
   * Bond buy/sell: cd_code and username from JWT; participant_code = first 7 chars of username.
   */
  private resolveBondOrderContextFromJwt(
    user: { cd_code?: string; username?: string } | undefined,
  ): { cd_code: string; order_entry: string; participant_code: string } {
    const cd_code = user?.cd_code?.trim();
    const order_entry = user?.username?.trim();
    if (!cd_code) {
      throw new HttpException(
        'CD code not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!order_entry || order_entry.length < 7) {
      throw new HttpException(
        'Username not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      cd_code,
      order_entry,
      participant_code: order_entry.substring(0, 7),
    };
  }

  private resolveCdCodeFromJwt(
    user: { cd_code?: string } | undefined,
  ): string {
    const cd_code = user?.cd_code?.trim();
    if (!cd_code) {
      throw new HttpException(
        'CD code not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return cd_code;
  }

  private resolveCdCodeFromPostBody(
    user: { cd_code?: string } | undefined,
    bodyCd: string,
  ): string {
    const cd = bodyCd?.trim();
    if (!cd) {
      throw new HttpException('cd_code is required', HttpStatus.BAD_REQUEST);
    }
    const tokenCd = user?.cd_code?.trim();
    if (tokenCd && cd !== tokenCd) {
      throw new ForbiddenException('CD code does not match authenticated user');
    }
    return cd;
  }
}
