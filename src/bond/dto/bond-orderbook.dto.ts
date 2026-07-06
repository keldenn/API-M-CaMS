import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class BondOrderbookRequestDto {
  @ApiProperty({ example: 118, description: 'Selected bond symbol ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  symbol_id!: number;
}

export class BondOrderbookLevelDto {
  @ApiProperty({ example: 1020 })
  price!: number;

  @ApiProperty({ example: 100 })
  buy_vol!: number;

  @ApiProperty({ example: 50 })
  sell_vol!: number;
}

export class BondOrderbookResponseDto {
  @ApiProperty({ type: [BondOrderbookLevelDto] })
  data!: BondOrderbookLevelDto[];

  @ApiProperty({ example: 3 })
  count!: number;
}
