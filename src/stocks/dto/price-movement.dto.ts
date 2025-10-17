import { ApiProperty } from '@nestjs/swagger';

export class PriceMovementDto {
  @ApiProperty({
    description: 'Stock price at the specific date',
    example: 150.25,
    type: 'number',
    format: 'float'
  })
  price: number;

  @ApiProperty({
    description: 'Date and time when the price was recorded',
    example: '2025-10-15T10:30:00.000Z',
    type: 'string',
    format: 'date-time'
  })
  date: Date;
}

export class PriceMovementRequestDto {
  @ApiProperty({
    description: 'Stock symbol to get price movement data for',
    example: 'AAPL',
    type: 'string'
  })
  symbol: string;
}
