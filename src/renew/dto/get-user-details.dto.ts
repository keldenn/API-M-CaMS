import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetUserDetailsDto {
  @ApiProperty({
    description: 'Username to fetch renew user details',
    example: 'MEMBOBL12345678901',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
