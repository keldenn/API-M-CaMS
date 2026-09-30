import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BroadcastNotificationDto {
  @ApiProperty({
    description: 'Notification title shown on the device',
    example: 'Market notice',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Notification description shown on the device',
    example: 'Trading will close early today.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;
}
