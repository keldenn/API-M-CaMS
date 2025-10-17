import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IndexService } from './index.service';
import { IndexDataDto } from './dto/index-data.dto';

@ApiTags('stocks')
@Controller('stocks')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get('index')
  @ApiOperation({ 
    summary: 'Get index data',
    description: 'Retrieves current index data for all sectors. No authentication required.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Index data retrieved successfully',
    type: [IndexDataDto]
  })
  async getIndexData(): Promise<IndexDataDto[]> {
    return await this.indexService.getAllIndexData();
  }
}
