import { IsString, IsEnum, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterFcmTokenDto {
  @ApiProperty({
    description: 'CD code of the user',
    example: 'CD12345',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  cd_code: string;

  @ApiProperty({
    description: 'Firebase Cloud Messaging token',
    example: 'dXj8K9...(long token string)',
  })
  @IsString()
  @IsNotEmpty()
  fcm_token: string;

  @ApiProperty({
    description: 'Unique device identifier (UUID) - Required to prevent duplicate tokens',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  device_id: string;

  @ApiProperty({
    description: 'Device platform',
    enum: ['ios', 'android'],
    example: 'android',
    required: false,
  })
  @IsEnum(['ios', 'android'])
  @IsOptional()
  platform?: 'ios' | 'android';

  @ApiProperty({
    description: 'Device name/model',
    example: 'Samsung Galaxy S21',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  device_name?: string;

  @ApiProperty({
    description: 'App version',
    example: '1.0.0',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  app_version?: string;
}




