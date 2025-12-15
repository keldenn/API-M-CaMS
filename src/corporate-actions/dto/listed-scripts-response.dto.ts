import { ApiProperty } from '@nestjs/swagger';

export class ListedScriptsResponseDto {
  @ApiProperty({ example: '34', description: 'Symbol ID' })
  symbol_id: string;

  @ApiProperty({ example: 'GICB', description: 'Stock symbol' })
  symbol: string;

  @ApiProperty({
    example: 'GIC BHUTAN REINSURANCE CO. LTD.',
    description: 'Company name',
  })
  name: string;
}
