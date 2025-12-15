import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class SubmitUserDetailsDto {
  @ApiProperty({ description: 'CID Number', example: '11234567890' })
  @IsString()
  @IsNotEmpty()
  cidNo: string;

  @ApiProperty({ description: 'User address', example: 'Thimphu, Bhutan' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Broker/Participant code', example: 'MEMBOBL' })
  @IsString()
  @IsNotEmpty()
  broker: string;

  @ApiProperty({
    description: 'CD Code',
    example: 'B202500001',
    required: false,
  })
  @IsString()
  @IsOptional()
  cd_code?: string;

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Full name', example: 'Dorji Wangchuk' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Phone number', example: '17123456' })
  @IsString()
  @IsNotEmpty()
  phoneNo: string;

  @ApiProperty({ description: 'Username for broker', example: 'dorji_user' })
  @IsString()
  @IsNotEmpty()
  userName: string;

  @ApiProperty({ description: 'Order number', example: 'OT20251126001' })
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @ApiProperty({ description: 'Amount/Fee', example: 500, required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;
}
