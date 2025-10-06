import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GetClientDetailsDto {
  @ApiProperty({
    description: 'Username to get client details',
    example: 'test_user',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class ClientDetailsResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    username: string;
    email: string;
    phone: string;
  } | null;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Username for password reset',
    example: 'test_user',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Email address for verification',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;
}
