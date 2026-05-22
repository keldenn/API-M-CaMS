import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { emptyToUndefined, RequireEmailOrPhone } from './send-otp.dto';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address used when OTP was sent',
    example: 'user@example.com',
    required: false,
  })
  @Transform(emptyToUndefined)
  @RequireEmailOrPhone()
  @IsOptional()
  @ValidateIf((o: VerifyOtpDto) => o.email != null)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiProperty({
    description: 'Phone number used when OTP was sent',
    example: '12345678',
    required: false,
  })
  @Transform(emptyToUndefined)
  @RequireEmailOrPhone()
  @IsOptional()
  @ValidateIf((o: VerifyOtpDto) => o.phone_no != null)
  @IsString()
  @IsNotEmpty({ message: 'Please provide a valid phone number' })
  phone_no?: string;

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
