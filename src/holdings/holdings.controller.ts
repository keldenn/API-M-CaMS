import { Controller, Get, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HoldingsService } from './holdings.service';
import { HoldingsResponseDto } from './dto/holdings-response.dto';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

@ApiTags('Holdings')
@Controller('portfolio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get('holding')
  @ApiOperation({ summary: 'Get holdings for authenticated user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Holdings retrieved successfully',
    type: [HoldingsResponseDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error' 
  })
  async getHoldings(@Request() req): Promise<HoldingsResponseDto[]> {
    try {
      // Extract CD code from JWT token payload
      const cdCode = req.user.cd_code;
      
      if (!cdCode) {
        throw new HttpException('CD code not found in token', HttpStatus.UNAUTHORIZED);
      }
      
      return await this.holdingsService.getHoldingsByCdCode(cdCode);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error in getHoldings:', error);
      throw new HttpException('Failed to fetch holdings', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get portfolio statistics for authenticated user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Portfolio statistics retrieved successfully',
    type: PortfolioStatsDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error' 
  })
  async getPortfolioStats(@Request() req): Promise<PortfolioStatsDto> {
    try {
      // Extract username from JWT token payload
      const username = req.user.username;
      
      if (!username) {
        throw new HttpException('Username not found in token', HttpStatus.UNAUTHORIZED);
      }
      
      return await this.holdingsService.getPortfolioStats(username);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error in getPortfolioStats:', error);
      throw new HttpException('Failed to fetch portfolio statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
