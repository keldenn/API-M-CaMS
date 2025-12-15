import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number to verify OTP against',
    example: '12345678',
  })
  @IsString()
  @IsNotEmpty()
  phone_no: string;

  @ApiProperty({
    description: 'The OTP entered by the user',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class VerifyOtpResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: string;
}
