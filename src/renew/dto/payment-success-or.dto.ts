import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaymentSuccessOrDto {
  @ApiProperty({ description: 'Order number', example: 'OR20251126001' })
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @ApiProperty({
    description: 'Renewal fee amount',
    example: 500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  fee?: number;

  @ApiProperty({
    description: 'Email used during renewal submit form',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Payment gateway auth code (must be 00)',
    example: '00',
    required: false,
  })
  @IsOptional()
  @IsString()
  auth_code?: string;

  @ApiProperty({
    description: 'Payment gateway message type (must be AC)',
    example: 'AC',
    required: false,
  })
  @IsOptional()
  @IsString()
  msg_type?: string;
}
