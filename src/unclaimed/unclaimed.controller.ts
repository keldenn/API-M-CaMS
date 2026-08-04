import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UnclaimedService } from './unclaimed.service';
import { UnclaimedResponseDto } from './dto/unclaimed-response.dto';

@ApiTags('Unclaimed')
@Controller('unclaimed')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UnclaimedController {
  constructor(private readonly unclaimedService: UnclaimedService) {}

  @Get(':cid')
  @ApiOperation({
    summary: 'Get unclaimed dividend/rights details by CID',
    description:
      'Returns unpaid unclaimed records (status IS NULL or not Paid) for the given CID from the unclaimed database. Uses indexed lookup on cid.',
  })
  @ApiParam({
    name: 'cid',
    description: 'Client CID / national ID',
    example: '11505002806',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Unclaimed details retrieved successfully',
    type: UnclaimedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid CID format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getByCid(@Param('cid') cid: string): Promise<UnclaimedResponseDto> {
    const trimmedCid = cid?.trim();

    if (!trimmedCid || !/^\d+$/.test(trimmedCid)) {
      throw new HttpException(
        'cid must contain only digits',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const data = await this.unclaimedService.getByCid(trimmedCid);

      return {
        error: false,
        message:
          data.total_items === 0
            ? 'No unclaimed details found'
            : 'Unclaimed details retrieved successfully',
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in unclaimed/:cid:', error);
      throw new HttpException(
        'Failed to fetch unclaimed details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
