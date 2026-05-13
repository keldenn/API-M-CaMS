import { ApiProperty } from '@nestjs/swagger';

export class WalletTrxHistoryItemDto {
  @ApiProperty({ description: 'Transaction amount', example: '-500.00' })
  amount: string;

  @ApiProperty({
    description: 'Transaction date (YYYY-MM-DD)',
    example: '2026-05-10',
  })
  trx_time: string;

  @ApiProperty({ description: 'Transaction type', example: 'DR' })
  type: string;

  @ApiProperty({ description: 'Paid to / purpose', example: 'IPO' })
  paid_to_user: string;
}

export class WalletTrxHistoryResponseDto {
  @ApiProperty({ description: 'Error status', example: false })
  error: boolean;

  @ApiProperty({ description: 'Response message', example: 'Successful' })
  message: string;

  @ApiProperty({ type: [WalletTrxHistoryItemDto] })
  data: WalletTrxHistoryItemDto[];
}
