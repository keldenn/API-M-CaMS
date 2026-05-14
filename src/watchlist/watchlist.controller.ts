import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { WatchlistService } from './watchlist.service';
import { WatchlistMutationDto } from './dto/watchlist-mutation.dto';
import { WatchlistResponseDto } from './dto/watchlist-response.dto';
import { WatchlistItemWithPriceDto } from './dto/watchlist-item-with-price.dto';

type JwtUser = { cd_code?: string };

@ApiTags('watchlist')
@Controller('watchlist')
@ApiBearerAuth('JWT-auth')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  @ApiOperation({
    summary: 'Get watchlist with live prices',
    description:
      'Returns all `users_watchlist` rows for the authenticated user. `cd_code` is taken from the JWT access token (no body). Each item uses the same price and day change logic as GET /stocks/price; `addedAt` is `users_watchlist.created_At`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Watchlist with prices (empty array if none)',
    type: [WatchlistItemWithPriceDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWatchlist(
    @Request() req: ExpressRequest & { user: JwtUser },
  ): Promise<WatchlistItemWithPriceDto[]> {
    return this.watchlistService.getWatchlistWithPrices(req.user?.cd_code ?? '');
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
