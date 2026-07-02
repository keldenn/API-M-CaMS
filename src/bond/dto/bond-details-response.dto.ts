import { ApiProperty } from '@nestjs/swagger';

export class BondDetailsResponseDto {
  @ApiProperty({ example: '2030-06-30', nullable: true })
  maturity_date!: string | null;

  @ApiProperty({ example: 1000, nullable: true })
  face_value!: number | null;

  @ApiProperty({ example: 7.5, nullable: true })
  coupon_rates!: number | null;
}
