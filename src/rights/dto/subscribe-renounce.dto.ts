import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SubscribeRenounceDto {
  @ApiProperty({
    description: 'BFS order id from the rights renounce payment',
    example: '202607061430001',
  })
  @IsString()
  @IsNotEmpty()
  order_no: string;

  @ApiProperty({
    description: 'CD code of the renouncee receiving the rights',
    example: 'U202500017',
  })
  @IsString()
  @IsNotEmpty()
  renounce_cd_code: string;
}

export class SubscribeRenounceResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Rights renounce processed successfully' })
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
