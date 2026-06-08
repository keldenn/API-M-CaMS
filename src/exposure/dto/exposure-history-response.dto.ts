import { ApiProperty } from '@nestjs/swagger';

export class ExposureRecordDto {
  @ApiProperty({ example: 0 })
  status: number;

  @ApiProperty({ example: 0, nullable: true })
  approval_status: number | null;

  @ApiProperty({ example: '2026-06-08T10:30:00.000Z', nullable: true })
  approved_date: string | null;

  @ApiProperty({ example: '3000.00' })
  amount: string;

  @ApiProperty({ example: 1, description: '1 = credit, 0 = debit' })
  flag: number;

  @ApiProperty({ example: '2026-06-08T10:30:00.000Z' })
  finance_date: string;
}

export class ExposureHistoryResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Successful' })
  message: string;

  @ApiProperty({ type: [ExposureRecordDto] })
  data: ExposureRecordDto[];
}
