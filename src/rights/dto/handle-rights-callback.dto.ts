import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HandleRightsCallbackDto {
  @ApiProperty({
    description: 'BFS order id from the rights subscription payment',
    example: '202607061430001',
  })
  @IsString()
  @IsNotEmpty()
  order_no: string;
}

export class HandleRightsCallbackResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Rights callback processed successfully' })
  message: string;

  @ApiProperty({ example: '202607061430001' })
  order_no: string;

  @ApiProperty({ example: 12345, required: false })
  order_id?: number;

  @ApiProperty({
    description: 'Set to 1 when SMS or email delivery succeeds',
    example: 1,
  })
  email_status: number;

  @ApiProperty({ example: true, required: false })
  sms_sent?: boolean;

  @ApiProperty({ example: true, required: false })
  email_sent?: boolean;
}
