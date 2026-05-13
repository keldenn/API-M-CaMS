import { ApiProperty } from '@nestjs/swagger';

export class WalletBalanceItemDto {
  @ApiProperty({
    description: 'Current wallet balance for the authenticated cd_code',
    example: '12000.50',
  })
  total: string;
}

export class WalletBalanceResponseDto {
  @ApiProperty({ description: 'Error status', example: false })
  error: boolean;

  @ApiProperty({ description: 'Response message', example: 'Successful' })
  message: string;

  @ApiProperty({ type: [WalletBalanceItemDto] })
  data: WalletBalanceItemDto[];
}
