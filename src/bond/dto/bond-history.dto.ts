import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BondHistoryRequestDto {
  @ApiProperty({ example: 'U202500016', description: 'Client CD code' })
  @IsString()
  @IsNotEmpty()
  cd_code!: string;
}

export class BondExecutedHistoryItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'U202500016' })
  cd_code!: string;

  @ApiProperty({ example: 'MEMBNBL' })
  participant_code!: string;

  @ApiProperty({ example: 'MEMBNBL10811000167' })
  sub_user!: string;

  @ApiProperty({ example: 'MEMBNBL' })
  member_broker!: string;

  @ApiProperty({ example: '2026-02-07 10:40:33' })
  order_date!: string;

  @ApiProperty({ example: 118 })
  symbol_id!: number;

  @ApiProperty({ example: 'GNBB2035' })
  symbol!: string;

  @ApiProperty({ example: 'Government of Bhutan Bond 2035' })
  name!: string;

  @ApiProperty({ example: 'GB' })
  security_type!: string;

  @ApiProperty({ example: 1020 })
  order_exe_price!: number;

  @ApiProperty({ example: 100 })
  lot_size_execute!: number;

  @ApiProperty({ example: 1 })
  status!: number;

  @ApiProperty({ example: 'B', enum: ['B', 'S'] })
  side!: string;

  @ApiProperty({ example: 0 })
  lot_check!: number;

  @ApiProperty({ example: '260702104033' })
  flag_id!: string;

  @ApiProperty({ example: 1026.84 })
  dirty_price!: number;

  @ApiProperty({ example: 6.84 })
  accur_rate!: number;

  @ApiProperty({ example: 9.64 })
  ytm!: number;

  @ApiProperty({ example: 'OTC' })
  order_type!: string;

  @ApiProperty({ example: '2026-02-07 10:40:33' })
  created_at!: string;
}

export class BondExecutedHistoryResponseDto {
  @ApiProperty({ type: [BondExecutedHistoryItemDto] })
  data!: BondExecutedHistoryItemDto[];

  @ApiProperty({ example: 1 })
  count!: number;
}
