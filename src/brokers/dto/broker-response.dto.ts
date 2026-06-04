import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BrokerResponseDto {
  @ApiPropertyOptional({ example: 'MEMDSBP' })
  participant_code?: string | null;

  @ApiProperty({
    example: 'BHUTAN DEVELOPMENT BANK LIMITED, P.B.# 256, THIMPHU',
  })
  address!: string;

  @ApiProperty({ example: 5 })
  institution_id!: number;

  @ApiProperty({ example: 322266 })
  phone!: number;

  @ApiProperty({ example: '' })
  email!: string;

  @ApiProperty({ example: 'Bhutan Development Bank Limited' })
  name!: string;
}
