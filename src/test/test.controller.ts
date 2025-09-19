import { Controller, Get } from '@nestjs/common';

@Controller('test')
export class TestController {
  @Get()
  getTest(): string {
    return 'Hello from NestJS API deployed on IIS!';
  }

  @Get('ping')
  getPing(): object {
    return { 
      message: 'Pong!', 
      timestamp: new Date().toISOString(),
      status: 'OK'
    };
  }
}