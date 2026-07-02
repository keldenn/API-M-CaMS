import { ApiProperty } from '@nestjs/swagger';

export class BondPendingOrderItemDto {
  @ApiProperty({ example: 42 })
  order_id!: number;

  @ApiProperty({ example: 'U202500016' })
  cd_code!: string;

  @ApiProperty({ example: 'MEMBNBL' })
  participant_code!: string;

  @ApiProperty({ example: 'MEMBNBL' })
  member_broker!: string;

  @ApiProperty({ example: 100 })
  order_size!: number;

  @ApiProperty({ example: 'MEMBNBL10811000167' })
  order_entry!: string;

  @ApiProperty({ example: '260702104033' })
  flag_id!: string;

  @ApiProperty({ example: 0 })
  sell_vol!: number;

  @ApiProperty({ example: 100 })
  buy_vol!: number;

  @ApiProperty({ example: 1020 })
  price!: number;

  @ApiProperty({ example: 'B', enum: ['B', 'S'] })
  side!: string;

  @ApiProperty({ example: 106.27 })
  commis_amt!: number;

  @ApiProperty({ example: '2026-02-07 10:40:33' })
  order_date!: string;

  @ApiProperty({ example: 6.84 })
  acc_intrt!: number;

  @ApiProperty({ example: 1026.84 })
  dirty_price!: number;

  @ApiProperty({ example: 9.64 })
  ytm!: number;

  @ApiProperty({ example: 'GNBB2035' })
  symbol!: string;

  @ApiProperty({ example: 118 })
  symbol_id!: number;

  @ApiProperty({ example: 'GB' })
  security_type!: string;
}

export class BondPendingOrdersResponseDto {
  @ApiProperty({ type: [BondPendingOrderItemDto] })
  data!: BondPendingOrderItemDto[];

  @ApiProperty({ example: 1 })
  count!: number;
}
