import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class SubscribeRightsDto {
  @ApiProperty({ description: 'Symbol id for the rights offer', example: 20 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  symbol_id: number;

  @ApiProperty({
    description: 'BFS order id (stored as bfs_orderid)',
    example: '202607061430001',
  })
  @IsString()
  @IsNotEmpty()
  order_no: string;

  @ApiProperty({ description: 'Subscription amount', example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Volume applied for rights subscription', example: 100 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  vol_applied: number;

  @ApiProperty({ description: 'Rights price per unit', example: 50 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({
    description: 'Additional subscription details',
    example: 'Rights subscription via mCaMS',
  })
  @IsString()
  @IsNotEmpty()
  details: string;
}

export class SubscribeRightsResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Rights subscription submitted successfully' })
  message: string;

  @ApiProperty({ example: 12345, required: false })
  insert_id?: number;
}
