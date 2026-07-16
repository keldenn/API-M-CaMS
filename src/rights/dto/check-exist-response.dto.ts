import { ApiProperty } from '@nestjs/swagger';

export class RightsCheckExistItemDto {
  @ApiProperty({ example: 12345 })
  client_id: number;

  @ApiProperty({ example: 'U000002177' })
  cd_code: string;

  @ApiProperty({ example: 'John' })
  f_name: string;

  @ApiProperty({ example: 'Doe' })
  l_name: string;

  @ApiProperty({ example: '17123456' })
  phone: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 1 })
  bank_id: number;

  @ApiProperty({ example: '1234567890' })
  bank_account: string;

  @ApiProperty({ example: 1000 })
  volume: number;

  @ApiProperty({ example: 500 })
  ribon_volume: number;

  @ApiProperty({ example: '2026-01-15' })
  record_date: string;

  @ApiProperty({ example: 100 })
  order_total: number;

  @ApiProperty({ example: 400 })
  available_rights: number;
}

export class RightsCheckExistResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Rights record found' })
  message: string;

  @ApiProperty({ example: true })
  exists: boolean;

  @ApiProperty({
    example: 20,
    type: Number,
    nullable: true,
    description: 'Rate from corporate_announcement for the given corp_announcement_id',
  })
  rate: number | null;

  @ApiProperty({ type: [RightsCheckExistItemDto] })
  data: RightsCheckExistItemDto[];
}
