import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WatchlistService } from './watchlist.service';
import { WatchlistMutationDto } from './dto/watchlist-mutation.dto';
import { WatchlistResponseDto } from './dto/watchlist-response.dto';
import { WatchlistListResponseDto } from './dto/watchlist-list-response.dto';

@ApiTags('watchlist')
@Controller('watchlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user watchlist with live prices',
    description:
      'Returns all symbols on `users_watchlist` for the authenticated user. `cd_code` is taken from the JWT access token only (no query/body `cd_code`). Prices use the same source as `GET /stocks/price`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Watchlist retrieved successfully',
    type: WatchlistListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized or cd_code missing in token' })
  async getWatchlist(
    @Request() req: { user?: { cd_code?: string } },
  ): Promise<WatchlistListResponseDto> {
    const cd_code = req.user?.cd_code?.trim();
    if (!cd_code) {
      throw new HttpException(
        'CD code not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const items = await this.watchlistService.getByCdCode(cd_code);
    return {
      success: true,
      cd_code,
      items,
      count: items.length,
    };
  }

  @Post('add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add symbol to user watchlist',
    description:
      'Inserts a row into `users_watchlist` for the given `cd_code` and `symbol`. Duplicate pairs are ignored (existing row returned). Use the same `cd_code` as for `POST /fcm/register-token` so price alerts reach the device.',
  })
  @ApiResponse({
    status: 200,
    description: 'Added or already present',
    type: WatchlistResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async add(@Body() body: WatchlistMutationDto): Promise<WatchlistResponseDto> {
    return this.watchlistService.add(body);
  }

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove symbol from user watchlist',
    description:
      'Deletes the matching row from `users_watchlist` for the given cd_code and symbol.',
  })
  @ApiResponse({
    status: 200,
    description: 'Removed successfully',
    type: WatchlistResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'No matching watchlist entry',
  })
  async remove(
    @Body() body: WatchlistMutationDto,
  ): Promise<WatchlistResponseDto> {
    return this.watchlistService.remove(body);
  }
}
