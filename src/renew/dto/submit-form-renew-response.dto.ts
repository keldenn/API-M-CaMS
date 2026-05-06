import { ApiProperty } from '@nestjs/swagger';

class SubmitFormRenewErrorDataDto {
  @ApiProperty({ example: true })
  insert: boolean;

  @ApiProperty({ example: false })
  update: boolean;
}

export class SubmitFormRenewResponseDto {
  @ApiProperty({ example: '200' })
  status: string;

  @ApiProperty({ example: 'Application submitted successfully.' })
  message: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  email?: string;

  @ApiProperty({ example: 100, required: false })
  app_fee?: number;

  @ApiProperty({ example: 18, required: false })
  gst?: number;

  @ApiProperty({ example: '20260506220530', required: false })
  date?: string;

  @ApiProperty({ example: 'OT20251126001', required: false })
  order_no?: string;

  @ApiProperty({ type: SubmitFormRenewErrorDataDto, required: false })
  data?: SubmitFormRenewErrorDataDto;
}
