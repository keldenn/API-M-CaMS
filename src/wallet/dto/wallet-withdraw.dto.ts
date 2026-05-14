import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class WalletWithdrawDto {
  @ApiProperty({
    description: 'Withdrawal amount (positive number; same as legacy `Amount`)',
    example: 1000.5,
  })
  @Type(() => Number)
  @IsNumber()
  Amount: number;

  @ApiProperty({ description: 'Client CD code', example: 'CD123456' })
  @IsString()
  @IsNotEmpty()
  cd_code: string;

  @ApiProperty({
    description: 'Username (must match JWT `username`)',
    example: 'MEMRNRB0011234567',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class WalletWithdrawResponseDto {
  @ApiProperty({
    example:
      'Successful, Your bank account will be credited within 1 or 2 working days.',
  })
  message: string;
}
