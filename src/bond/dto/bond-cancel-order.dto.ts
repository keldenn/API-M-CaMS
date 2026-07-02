import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/** Body fields from pending order row. */
export class BondCancelOrderRequestDto {
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
}

export class BondCancelOrderResponseDto {
  @ApiProperty({ example: 'Order cancelled successfully.' })
  message!: string;
}
