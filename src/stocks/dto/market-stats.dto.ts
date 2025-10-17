import { ApiProperty } from '@nestjs/swagger';

export class MarketStatsDto {
  @ApiProperty({
    description: 'Total market capitalization',
    example: 1500000000.50,
    type: 'number',
    format: 'float'
  })
  market_cap: number;

  @ApiProperty({
    description: 'Total number of listed scripts',
    example: 150,
    type: 'number',
    format: 'integer'
  })
  total_listed_scripts: number;
}