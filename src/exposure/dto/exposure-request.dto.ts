import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class ExposureRequestDto {
  @ApiProperty({ description: 'Client CD code', example: 'RICB00001' })
  @IsString()
  @IsNotEmpty()
  cd_code: string;

  @ApiProperty({
    description: 'Amount (positive number; debit is stored as negative)',
    example: 3000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ExposureResponseDto {
  @ApiProperty({ example: 'Successful' })
  message: string;

  @ApiProperty({ example: 402514 })
  finance_id: number;
}
