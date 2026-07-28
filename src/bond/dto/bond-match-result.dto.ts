import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type BondMatchStatus = 'MATCHED' | 'NO_MATCH' | 'FAILED';

export class BondMatchFillDto {
  @ApiProperty({ example: 100 })
  volume!: number;

  @ApiProperty({ example: 1010 })
  price!: number;
}

export class BondMatchResultDto {
  @ApiProperty({ enum: ['MATCHED', 'NO_MATCH', 'FAILED'] })
  status!: BondMatchStatus;

  @ApiProperty({ example: true })
  traded!: boolean;

  @ApiProperty({ type: [BondMatchFillDto] })
  fills!: BondMatchFillDto[];

  @ApiProperty({ example: 100 })
  total_traded!: number;

  @ApiProperty({ example: 0 })
  remaining!: number;

  @ApiPropertyOptional({
    example: 'Order remains pending because matching could not be completed.',
  })
  message?: string;
}
