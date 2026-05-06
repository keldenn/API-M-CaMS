import { ApiProperty } from '@nestjs/swagger';

class RenewUserDetailsDataDto {
  @ApiProperty({ example: 'B202400001' })
  client_code: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: '12345678901' })
  cid: string;

  @ApiProperty({ example: 'MEMBOBL' })
  participant_code: string;

  @ApiProperty({ example: 'MEMBOBL12345678901' })
  username: string;

  @ApiProperty({ example: '17123456', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'john@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: 'Thimphu', nullable: true })
  address: string | null;
}

export class GetUserDetailsResponseDto {
  @ApiProperty({ example: '200' })
  status: string;

  @ApiProperty({ example: 'Depository Account present' })
  message: string;

  @ApiProperty({
    type: [RenewUserDetailsDataDto],
    required: false,
  })
  data?: RenewUserDetailsDataDto[];
}
