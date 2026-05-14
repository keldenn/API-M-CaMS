import {
  Body,
  Controller,
  ForbiddenException,
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
import { WalletService } from './wallet.service';
import { WalletBalanceResponseDto } from './dto/wallet-balance-response.dto';
import { WalletTrxHistoryResponseDto } from './dto/wallet-trx-history-response.dto';
import {
  WalletWithdrawDto,
  WalletWithdrawResponseDto,
} from './dto/wallet-withdraw.dto';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /** GET: `cd_code` from JWT only. */
  @Get('getBalance')
  @ApiOperation({
    summary: 'Get wallet balance for authenticated user',
    description:
      'Returns wallet balance using `cd_code` from the JWT access token (GET — no body `cd_code`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance fetched successfully',
    type: WalletBalanceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getBalance(@Request() req): Promise<WalletBalanceResponseDto> {
    try {
      const cdCode = req.user?.cd_code;

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const total = await this.walletService.getWalletBalance(cdCode);

      return {
        error: false,
        message: 'Successful',
        data: [{ total }],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in wallet/getBalance:', error);
      throw new HttpException(
        'Failed to fetch wallet balance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** GET: `cd_code` from JWT only. */
  @Get('WalletTrxHistory')
  @ApiOperation({
    summary: 'Get wallet transaction history (JWT cd_code)',
    description:
      'Same query as legacy `WalletTrxHistory`. **GET**: `cd_code` is taken only from the JWT (not the body).',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction list or empty list',
    type: WalletTrxHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async walletTrxHistoryGet(
    @Request() req,
  ): Promise<WalletTrxHistoryResponseDto> {
    try {
      const cdCode = req.user?.cd_code;

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return this.buildTrxHistoryResponse(cdCode);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in GET wallet/WalletTrxHistory:', error);
      throw new HttpException(
        'Failed to fetch wallet transaction history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw wallet balance (legacy WithdrawWalletBalance)',
    description:
      '**POST**: Body is `Amount`, `cd_code`, and `username` only. A static legacy `WithdrawWalletBalance` field is added server-side when writing `mobile_api_log` (PHP parity). `cd_code` is not taken from the JWT for the DB operations; if the JWT includes `cd_code`, it must match the body. `username` must match the JWT `username`.',
  })
  @ApiBody({ type: WalletWithdrawDto })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal recorded',
    type: WalletWithdrawResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation or business rule failure (e.g. insufficient balance)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Username or CD code does not match authenticated user',
  })
  async withdraw(
    @Request() req,
    @Body() dto: WalletWithdrawDto,
  ): Promise<WalletWithdrawResponseDto> {
    this.assertJwtUsernameMatches(req.user, dto.username);
    const cd_code = this.resolveCdCodeFromPostBody(req.user, dto.cd_code);
    return this.walletService.withdrawWallet({
      amount: dto.Amount,
      cd_code,
      username: dto.username.trim(),
    });
  }

  private async buildTrxHistoryResponse(
    cdCode: string,
  ): Promise<WalletTrxHistoryResponseDto> {
    const rows = await this.walletService.getWalletTrxHistory(cdCode);

    if (rows.length === 0) {
      return {
        error: false,
        message: 'No Symbols.',
        data: [],
      };
    }

    return {
      error: false,
      message: 'Successful',
      data: rows,
    };
  }

  /**
   * POST flows use `cd_code` from the body for queries. If the token carries
   * `cd_code`, it must match the body (prevents operating another wallet).
   */
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

  private assertJwtUsernameMatches(
    user: { username?: string } | undefined,
    bodyUsername: string,
  ): void {
    const u = bodyUsername?.trim();
    if (!u || !user?.username) {
      throw new ForbiddenException('Username does not match authenticated user');
    }
    if (user.username.trim() !== u) {
      throw new ForbiddenException('Username does not match authenticated user');
    }
  }
}
