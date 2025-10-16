import { Controller, Get } from '@nestjs/common';
import { IndexService } from './index.service';
import { IndexDataDto } from './dto/index-data.dto';

@Controller('stocks')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get('index')
  async getIndexData(): Promise<IndexDataDto[]> {
    return await this.indexService.getAllIndexData();
  }
}
