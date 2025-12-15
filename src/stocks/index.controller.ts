import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IndexService } from './index.service';
import { IndexDataDto } from './dto/index-data.dto';

@ApiTags('stocks')
@Controller('stocks')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get('index')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get index data',
    description:
      'Retrieves current index data for all sectors. Requires JWT authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Index data retrieved successfully',
    type: [IndexDataDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getIndexData(): Promise<IndexDataDto[]> {
    return await this.indexService.getAllIndexData();
  }
}
