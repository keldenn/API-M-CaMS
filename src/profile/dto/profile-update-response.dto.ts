import { ApiProperty } from '@nestjs/swagger';

export class ProfileUpdateResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({ example: 'Email updated successfully.' })
  message: string;
}
