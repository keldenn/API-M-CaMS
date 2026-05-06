import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SubmitFormRenewDto {
  @ApiProperty({
    description: 'mCaMS username',
    example: 'MEMBOBL12345678901',
  })
  @IsString()
  userName: string;

  @ApiProperty({
    description: 'Email used for payment/renewal',
    example: 'user@example.com',
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Payment order number',
    example: 'OT20251126001',
  })
  @IsString()
  orderNo: string;

  @ApiProperty({
    description: 'CD Code (optional override)',
    example: 'B202500001',
    required: false,
  })
  @IsOptional()
  @IsString()
  cdCode?: string;

  @ApiProperty({
    description: 'Application fee',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  fee?: number;

  @ApiProperty({
    description: 'GST amount',
    example: 18,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  gst?: number;
}
