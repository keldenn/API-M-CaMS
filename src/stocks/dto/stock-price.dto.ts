import { ApiProperty } from '@nestjs/swagger';

export class StockPriceDto {
  @ApiProperty({
    description: 'Stock symbol',
    example: 'AAPL',
    type: 'string'
  })
  symbol: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Apple Inc.',
    type: 'string'
  })
  name: string;

  @ApiProperty({
    description: 'Current stock price',
    example: 150.25,
    type: 'number',
    format: 'float'
  })
  currentPrice: number;

  @ApiProperty({
    description: 'Price change from previous close',
    example: 2.50,
    type: 'number',
    format: 'float'
  })
  priceChange: number;

  @ApiProperty({
    description: 'Timestamp of the price data',
    example: '2025-10-15T10:30:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  timestamp: Date;
}

