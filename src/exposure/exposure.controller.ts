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
import {
  ExposureRequestDto,
  ExposureResponseDto,
} from './dto/exposure-request.dto';
import { ExposureHistoryResponseDto } from './dto/exposure-history-response.dto';
import { ExposureService } from './exposure.service';

@ApiTags('exposure')
@Controller('exposure')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ExposureController {
  constructor(private readonly exposureService: ExposureService) {}

  @Get('history')
  @ApiOperation({
    summary: 'Get exposure history for authenticated user',
    description:
      'Returns all `bbo_finance` records (`status`, `approval_status`, `approved_date`, `amount`, `flag`, `finance_date`) for the authenticated user using `cd_code` from the JWT access token only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Exposure history fetched successfully',
    type: ExposureHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getHistory(@Request() req): Promise<ExposureHistoryResponseDto> {
    try {
      const cdCode = req.user?.cd_code?.trim();

      if (!cdCode) {
        throw new HttpException(
          'CD code not found in token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const data = await this.exposureService.getExposureHistory(cdCode);

      if (data.length === 0) {
        return {
          error: false,
          message: 'No exposure records found',
          data: [],
        };
      }

      return {
        error: false,
        message: 'Successful',
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in GET exposure/history:', error);
      throw new HttpException(
        'Failed to fetch exposure history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('credit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create exposure credit entry',
    description:
      'Inserts a credit record into `bbo_finance` with `flag=1`, `flag_id=1`, `status=0`, and `approval_status=0`. `username` and `institution_id` are resolved from `users` / `client_account` by `cd_code`. Remarks are set server-side to `mcmas exposure credit request`.',
  })
  @ApiBody({ type: ExposureRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Credit entry created',
    type: ExposureResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation or insert failure',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'CD code does not match authenticated user',
  })
  async credit(
    @Request() req,
    @Body() dto: ExposureRequestDto,
  ): Promise<ExposureResponseDto> {
    const cd_code = this.resolveCdCodeFromPostBody(req.user, dto.cd_code);

    const { finance_id } = await this.exposureService.createCredit({
      cd_code,
      amount: dto.amount,
    });

    return { message: 'Successful', finance_id };
  }

  @Post('debit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create exposure debit entry',
    description:
      'Inserts a debit record into `bbo_finance` with `flag=0`, `flag_id=0`, `status=0`, and `approval_status=0`. The amount is stored as a negative value (e.g. 3000 becomes -3000). `username` and `institution_id` are resolved from `users` / `client_account` by `cd_code`. Remarks are set server-side to `mcmas exposure debit request`.',
  })
  @ApiBody({ type: ExposureRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Debit entry created',
    type: ExposureResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation or insert failure',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'CD code does not match authenticated user',
  })
  async debit(
    @Request() req,
    @Body() dto: ExposureRequestDto,
  ): Promise<ExposureResponseDto> {
    const cd_code = this.resolveCdCodeFromPostBody(req.user, dto.cd_code);

    const { finance_id } = await this.exposureService.createDebit({
      cd_code,
      amount: dto.amount,
    });

    return { message: 'Successful', finance_id };
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
