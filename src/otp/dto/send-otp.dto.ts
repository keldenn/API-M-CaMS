import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'Email address to send OTP',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiProperty({
    description: 'Phone number to send OTP',
    example: '12345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone_no?: string;
}

export class SendOtpResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: string;
}
