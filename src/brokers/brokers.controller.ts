import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrokersService } from './brokers.service';
import { BrokerResponseDto } from './dto/broker-response.dto';

@ApiTags('broker')
@Controller('brokers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all active brokers',
    description:
      'Returns all participant records from adm_participants where status = 1.',
  })
  @ApiOkResponse({
    description: 'Active brokers retrieved successfully',
    type: BrokerResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async findAll(): Promise<BrokerResponseDto[]> {
    return this.brokersService.findAllActive();
  }
}
