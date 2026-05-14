import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WatchlistService } from './watchlist.service';
import { WatchlistMutationDto } from './dto/watchlist-mutation.dto';
import { WatchlistResponseDto } from './dto/watchlist-response.dto';

@ApiTags('watchlist')
@Controller('watchlist')
@ApiBearerAuth('JWT-auth')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

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
