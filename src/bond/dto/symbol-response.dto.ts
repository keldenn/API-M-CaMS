import { ApiProperty } from '@nestjs/swagger';

export class SymbolResponseDto {
  @ApiProperty({ example: 'BANK' })
  symbol!: string;

  @ApiProperty({ example: 123 })
  symbol_id!: number;

  @ApiProperty({ example: 'Bank of Example Ltd' })
  name!: string;
}
