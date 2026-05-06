import { ApiProperty } from '@nestjs/swagger';

export class PaymentSuccessOrResponseDto {
  @ApiProperty({ example: '200' })
  status: string;

  @ApiProperty({ example: 'Renewal application submitted successfully.' })
  message: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  email?: string;

  @ApiProperty({ example: 500, required: false })
  app_fee?: number;

  @ApiProperty({ example: '20260506223045', required: false })
  date?: string;

  @ApiProperty({ example: 'OR20251126001', required: false })
  order_no?: string;

  @ApiProperty({ required: false })
  error?: string;
}
