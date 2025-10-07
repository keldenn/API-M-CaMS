import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4, { message: 'Password must be at least 6 characters long' })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password (must match new password)',
    example: 'newPassword123',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;
}
