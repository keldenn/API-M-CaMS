import { ApiProperty } from '@nestjs/swagger';
import { WatchlistItemWithPriceDto } from './watchlist-item-with-price.dto';

export class WatchlistListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'CD123456' })
  cd_code: string;

  @ApiProperty({ type: [WatchlistItemWithPriceDto] })
  items: WatchlistItemWithPriceDto[];

  @ApiProperty({ example: 3 })
  count: number;
}
