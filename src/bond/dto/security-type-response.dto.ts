import { ApiProperty } from '@nestjs/swagger';

export class SecurityTypeResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'GB' })
  security_type!: string;

  @ApiProperty({ example: 'Government Bond' })
  precise_name!: string;
}
