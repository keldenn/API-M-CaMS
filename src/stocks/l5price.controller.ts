import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { L5PriceService } from './l5price.service';
import { L5PriceDto } from './dto/l5price.dto';

@ApiTags('l5price')
@Controller('l5price')
export class L5PriceController {
  private readonly logger = new Logger(L5PriceController.name);

  constructor(private readonly l5PriceService: L5PriceService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get L5price data',
    description: 'Retrieves the latest 5 days price movement data for all listed companies. Requires authentication.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'L5price data retrieved successfully',
    type: [L5PriceDto]
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Authentication required'
  })
  async getL5PriceData(): Promise<L5PriceDto[]> {
    this.logger.log('Fetching L5price data via REST API');
    return this.l5PriceService.getL5PriceData();
  }
}
