import { ApiProperty } from '@nestjs/swagger';

export class UnclaimedItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '1000027615', nullable: true })
  cd_code: string | null;

  @ApiProperty({ example: 'PHUNTSHO LHAMO', nullable: true })
  name: string | null;

  @ApiProperty({ example: '2012', nullable: true })
  year: string | null;

  @ApiProperty({ example: '306', nullable: true })
  amount: string | null;

  @ApiProperty({ example: 'DPNB', nullable: true })
  company: string | null;

  @ApiProperty({ example: '11505002806', nullable: true })
  cid: string | null;

  @ApiProperty({ example: 'Dividend', nullable: true })
  remarks: string | null;

  @ApiProperty({ example: '1010', nullable: true })
  name_of_bank: string | null;

  @ApiProperty({ example: '102440786', nullable: true })
  account_no: string | null;

  @ApiProperty({ example: 'Awaiting Payment', nullable: true })
  status: string | null;

  @ApiProperty({ example: 1, nullable: true })
  bank_acc_check: number | null;
}

export class UnclaimedDataDto {
  @ApiProperty({ example: '11505002806' })
  cid: string;

  @ApiProperty({ example: 3 })
  total_items: number;

  @ApiProperty({
    example: 850.5,
    description: 'Sum of unpaid amounts (commas stripped from varchar amounts)',
  })
  total_amount: number;

  @ApiProperty({ type: [UnclaimedItemDto] })
  items: UnclaimedItemDto[];
}

export class UnclaimedResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Unclaimed details retrieved successfully' })
  message: string;

  @ApiProperty({ type: UnclaimedDataDto })
  data: UnclaimedDataDto;
}
