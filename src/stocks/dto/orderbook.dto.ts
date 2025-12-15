import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class OrderbookRequestDto {
  @ApiProperty({
    description: 'Stock symbol to get orderbook data for',
    example: 'AAPL',
    type: 'string',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  Symbol: string;
}

export class OrderbookLevelDto {
  @ApiProperty({
    description: 'Buy volume at this price level',
    example: 1000,
    type: 'number',
  })
  BuyVol: number;

  @ApiProperty({
    description: 'Price level',
    example: '150.25',
    type: 'string',
  })
  Price: string;

  @ApiProperty({
    description: 'Sell volume at this price level',
    example: 500,
    type: 'number',
  })
  SellVol: number;

  @ApiProperty({
    description: 'Discovered price (price with maximum tradable volume)',
    example: '150.25',
    type: 'string',
  })
  Discovered: string;

  @ApiProperty({
    description: 'Maximum tradable volume at this price level',
    example: 500,
    type: 'number',
  })
  maxTradable: number;
}

export class OrderbookResponseDto {
  @ApiProperty({
    description: 'Error flag',
    example: false,
    type: 'boolean',
  })
  error: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Success',
    type: 'string',
  })
  message: string;

  @ApiProperty({
    description: 'Orderbook data',
    type: [OrderbookLevelDto],
  })
  data: OrderbookLevelDto[];

  @ApiProperty({
    description: 'Discovered price (price with maximum tradable volume)',
    example: '150.25',
    type: 'string',
  })
  discoveredPrice: string;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2025-01-15 10:30:00',
    type: 'string',
  })
  timestamp: string;
}
