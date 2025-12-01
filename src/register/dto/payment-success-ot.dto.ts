import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class PaymentSuccessOtDto {
  @ApiProperty({ description: 'Order number', example: 'OT20251126001' })
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @ApiProperty({ description: 'CID Number', example: '11234567890' })
  @IsString()
  @IsNotEmpty()
  cidNo: string;

  @ApiProperty({ description: 'CD Code', example: 'B202500001' })
  @IsString()
  @IsNotEmpty()
  cd_code: string;

  @ApiProperty({ description: 'Broker/Participant code', example: 'MEMBOBL' })
  @IsString()
  @IsNotEmpty()
  broker: string;

  @ApiProperty({ description: 'Full name', example: 'Dorji Wangchuk' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Phone number', example: '17123456' })
  @IsString()
  @IsOptional()
  phoneNo?: string;

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'User address', example: 'Thimphu, Bhutan' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Username for broker', example: 'dorji_user' })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty({ description: 'Fee amount', example: 500 })
  @IsNumber()
  @IsOptional()
  fee?: number;
}

