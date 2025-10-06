import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Application')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({
    summary: 'Get application status',
    description: 'Returns application status',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is running',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  getStatus(): object {
    return {
      message: 'API-M-CaMS is running',
      timestamp: new Date().toISOString(),
      status: 'active',
    };
  }
}
