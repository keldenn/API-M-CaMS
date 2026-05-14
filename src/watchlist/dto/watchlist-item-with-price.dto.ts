import { ApiProperty } from '@nestjs/swagger';

export class WatchlistItemWithPriceDto {
  @ApiProperty({ example: 'RIGL' })
  symbol: string;

  @ApiProperty({ example: 'Royal Insurance' })
  name: string;

  @ApiProperty({
    description: 'Last market price (same source as GET /stocks/price)',
    example: 45.5,
  })
  price: number;

  @ApiProperty({
    description: 'Change vs previous close (market_price − ex_market_price)',
    example: 0.25,
  })
  change: number;

  @ApiProperty({
    description: 'Percent change vs previous close',
    example: 0.55,
  })
  changePercent: number;

  @ApiProperty({
    description: 'When the symbol was added to the watchlist (`users_watchlist.created_At`)',
    example: '2026-05-14T10:30:00.000Z',
  })
  addedAt: string;
}
