import { ApiProperty } from '@nestjs/swagger';

export class IndexDataDto {
  @ApiProperty({
    description: 'Sector type or BSI (Bhutan Stock Index)',
    example: 'BSI',
    type: 'string'
  })
  sector_type: string;

  @ApiProperty({
    description: 'Current index value',
    example: 1431.48,
    type: 'number',
    format: 'float'
  })
  current_index: number;

  @ApiProperty({
    description: 'Point change from previous value',
    example: -5.29,
    type: 'number',
    format: 'float'
  })
  ptChange: number;
}
