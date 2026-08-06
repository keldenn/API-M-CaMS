import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UnclaimedService } from './unclaimed.service';
import { UnclaimedResponseDto } from './dto/unclaimed-response.dto';
import {
  BulkUpdateUnclaimedDto,
  BulkUpdateUnclaimedResponseDto,
} from './dto/bulk-update-unclaimed.dto';

@ApiTags('Unclaimed')
@Controller('unclaimed')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UnclaimedController {
  constructor(private readonly unclaimedService: UnclaimedService) {}

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update unclaimed bank details by record IDs',
    description:
      'Updates name_of_bank, account_no, account_holder_cid, account_holder_name for the given ids (must belong to cid). Sets status to "Under Verification" (does not change bank_acc_check). Writes one audit_logs row per id with user_id = "mcmas", previous_value = prior status, new_value = "Under Verification".',
  })
  @ApiBody({ type: BulkUpdateUnclaimedDto })
  @ApiResponse({
    status: 200,
    description: 'Records updated successfully',
    type: BulkUpdateUnclaimedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or ownership error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No matching records found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async bulkUpdate(
    @Body() dto: BulkUpdateUnclaimedDto,
  ): Promise<BulkUpdateUnclaimedResponseDto> {
    try {
      const data = await this.unclaimedService.bulkUpdate(dto);

      return {
        error: false,
        message: 'Unclaimed details submitted for verification successfully',
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error in POST /unclaimed/update:', error);
      throw new HttpException(
        'Failed to update unclaimed details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':cid')
  @ApiOperation({
    summary: 'Get unclaimed dividend/rights details by CID',
    description:
      'Returns all unclaimed records for the given CID (all statuses, including Paid) from the unclaimed database. Uses indexed lookup on cid.',
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
