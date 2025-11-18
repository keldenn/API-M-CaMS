import { ApiProperty } from '@nestjs/swagger';

export class CdCodeResponseDto {
  @ApiProperty({
    description: 'Central Depository account code associated with the client account',
    example: '10811000167',
  })
  cd_code!: string;

  @ApiProperty({
    description: 'Institution identifier associated with the client account',
    example: '10001',
  })
  institution_id!: string;

  @ApiProperty({
    description: 'Name of the participant institution',
    example: 'ABC Securities Ltd.',
  })
  name!: string;
}

