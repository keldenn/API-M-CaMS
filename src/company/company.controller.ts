import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { FetchMarketDataResponseDto } from './dto/fetch-market-data-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Company')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('fetch-market-data/:script')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch market data for a script',
    description:
      'Retrieve comprehensive market data for a company script including current price, volume, financial metrics, 52-week high/low, weekly statistics, and market capitalization. This endpoint provides optimized database queries for fast response times.',
  })
  @ApiParam({
    name: 'script',
    description: 'Company script/ticker symbol (e.g., BNBL)',
    example: 'BNBL',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Market data retrieved successfully',
    type: FetchMarketDataResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Script parameter is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Script symbol not found in the database',
  })
  async fetchMarketData(
    @Param('script') script: string,
  ): Promise<FetchMarketDataResponseDto> {
    return this.companyService.fetchMarketData(script);
  }
}

