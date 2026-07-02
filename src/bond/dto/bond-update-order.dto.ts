import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Body fields align with pending order row + updated pricing/volume. */
export class BondUpdateOrderRequestDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_id!: number;

  @ApiProperty({ example: '260702104033' })
  @IsString()
  @IsNotEmpty()
  flag_id!: string;

  @ApiProperty({ example: 118 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  symbol_id!: number;

  @ApiProperty({ example: 'B', enum: ['B', 'S'] })
  @IsString()
  @IsIn(['B', 'S'])
  side!: 'B' | 'S';

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  order_size!: number;

  @ApiProperty({ example: 1020 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(99999999.99)
  price!: number;

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

export class BondUpdateOrderResponseDto {
  @ApiProperty({ example: 'Order updated successfully.' })
  message!: string;

  @ApiProperty({ example: 106.27 })
  commission!: number;

  @ApiProperty({ example: 5.31 })
  gst!: number;

  @ApiProperty({ example: 102111.58 })
  total_amount!: number;
}
