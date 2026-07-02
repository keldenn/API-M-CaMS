import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class BondYtmRequestDto {
  @ApiProperty({ example: 'RICB00001', description: 'Client CD code' })
  @IsString()
  @IsNotEmpty()
  cd_code!: string;

  @ApiProperty({ example: 123, description: 'Bond symbol ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  symbol_id!: number;

  @ApiProperty({
    example: 99.25,
    description: 'Clean price as percentage of face value',
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  clean_price!: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Trade quantity used for commission amount calculation',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;
}

export class BondYtmResponseDto {
  @ApiProperty({ example: 99.25 })
  clean_price!: number;

  @ApiProperty({ example: 0.7452 })
  accrued_interest!: number;

  @ApiProperty({ example: 99.9952 })
  dirty_price!: number;

  @ApiProperty({ example: 8.4123, description: 'Annualized YTM in percent' })
  ytm!: number;

  @ApiProperty({ example: 0.5, description: 'Broker commission rate in percent' })
  commission_rate!: number;

  @ApiProperty({ example: 49.9976, description: 'Commission amount for quantity' })
  commission_amount!: number;

  @ApiProperty({ example: '2026-06-30' })
  settlement_date!: string;

  @ApiProperty({ example: '2026-01-15' })
  last_coupon_date!: string;

  @ApiProperty({ example: '2026-07-15' })
  next_coupon_date!: string;

  @ApiProperty({ example: '2030-01-15' })
  maturity_date!: string;

  @ApiProperty({ example: 2, description: 'Coupon payments per year' })
  frequency!: number;
}
