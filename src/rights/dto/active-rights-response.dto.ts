import { ApiProperty } from '@nestjs/swagger';

export class ActiveRightsOfferDto {
  @ApiProperty({ example: 20 })
  symbol_id: number;

  @ApiProperty({ example: '2026-07-07T11:00:00.000Z' })
  start_at: string;

  @ApiProperty({ example: '2026-07-28T11:00:00.000Z' })
  end_at: string;

  @ApiProperty({ example: 120 })
  corp_announcement_id: number;

  @ApiProperty({ example: 1 })
  status: number;
}

export class ActiveRightsResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Active rights offers retrieved successfully' })
  message: string;

  @ApiProperty({ type: [ActiveRightsOfferDto] })
  data: ActiveRightsOfferDto[];
}
