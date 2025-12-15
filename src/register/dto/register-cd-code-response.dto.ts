import { ApiProperty } from '@nestjs/swagger';

export class RegisterCdCodeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Client account created successfully',
  })
  message: string;

  @ApiProperty({ description: 'Generated CD code', example: 'B202400001' })
  cd_code: string;

  @ApiProperty({ description: 'Client ID', example: 12345 })
  client_id: number;
}
