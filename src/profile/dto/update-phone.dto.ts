import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdatePhoneDto {
  @ApiProperty({
    description: 'New phone number (8 digits, must start with 17 or 77)',
    example: '17123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(17|77)\d{6}$/, {
    message: 'Phone number must be 8 digits and start with 17 or 77',
  })
  phone: string;
}
