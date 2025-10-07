import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ForgotChangePasswordDto {
  @ApiProperty({
    description: 'Username for password reset',
    example: 'test_user',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  // @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
  //   message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  // })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password (must match new password)',
    example: 'NewPassword123',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

export class ForgotChangePasswordResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;
}
