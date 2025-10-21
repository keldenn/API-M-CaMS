import { ApiProperty } from '@nestjs/swagger';

export class MarketDataResponseDto {
  @ApiProperty({
    description: 'Stock ticker symbol',
    example: 'BNBL',
  })
  ticker: string;

  @ApiProperty({
    description: 'Company name',
    example: 'BHUTAN NATIONAL BANK LTD.',
  })
  name: string;

  @ApiProperty({
    description: 'Dividend yield percentage',
    example: '0.00',
  })
  dividendYield: string;

  @ApiProperty({
    description: 'Beta value',
    example: '15.78',
  })
  beta: string;

  @ApiProperty({
    description: 'Trailing earnings per share',
    example: '10.88',
  })
  trailingEps: string;

  @ApiProperty({
    description: 'Price-to-earnings ratio',
    example: '2.75',
  })
  pe_ratio: string;

  @ApiProperty({
    description: '52-week high price',
    example: '34.50',
  })
  fiftyTwoWeekHigh: string;

  @ApiProperty({
    description: '52-week low price',
    example: '29.01',
  })
  fiftyTwoWeekLow: string;

  @ApiProperty({
    description: 'Weekly opening price',
    example: '32.00',
  })
  open: string;

  @ApiProperty({
    description: 'Weekly closing price',
    example: '32.00',
  })
  close: string;

  @ApiProperty({
    description: 'Weekly high price',
    example: '32.00',
  })
  weekHigh: string;

  @ApiProperty({
    description: 'Weekly low price',
    example: '30.71',
  })
  weekLow: string;

  @ApiProperty({
    description: 'Current market price',
    example: '31.95',
  })
  marketPrice: string;

  @ApiProperty({
    description: 'Market capitalization',
    example: 15598604877.75,
  })
  marketCap: number;

  @ApiProperty({
    description: 'Trading volume for the week',
    example: 63516,
  })
  volume: number;

  @ApiProperty({
    description: '30-day average trading volume',
    example: 25959.63,
  })
  averageVolume: number;
}
