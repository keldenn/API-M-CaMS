import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ChangePinDto {
  @ApiProperty({
    description: 'Current PIN for verification',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty()
  currentPin: string;

  @ApiProperty({
    description: 'New PIN (minimum 4 characters, numeric only)',
    example: '5678',
    minLength: 4,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4, { message: 'PIN must be at least 4 characters long' })
  @Matches(/^\d+$/, { message: 'PIN must contain only numbers' })
  newPin: string;

  @ApiProperty({
    description: 'Confirm new PIN (must match new PIN)',
    example: '5678',
  })
  @IsString()
  @IsNotEmpty()
  confirmPin: string;
}

export class ChangePinResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;
}
