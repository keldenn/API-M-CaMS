import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Client request body — cd_code, participant_code, order_entry, order_type come from JWT/server. */
export class BondSellRequestDto {
  @ApiProperty({ example: 118 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  symbol_id!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  order_size!: number;

  @ApiProperty({ example: 1020.0 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(99999999.99)
  price!: number;

  @ApiProperty({ example: 'S', enum: ['S'] })
  @IsString()
  @IsIn(['S'])
  side!: 'S';

  @ApiProperty({ example: 6.84 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acc_intrt!: number;

  @ApiProperty({ example: 1026.84 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  dirty_price!: number;

  @ApiProperty({ example: 9.64 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ytm!: number;
}

/** Full order payload after JWT-derived fields are applied server-side. */
export type BondSellOrderDto = BondSellRequestDto & {
  cd_code: string;
  participant_code: string;
  order_entry: string;
  order_type: 'OTC';
};
