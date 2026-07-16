import { ApiProperty } from '@nestjs/swagger';

export class NotifyEligibleRightsResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({
    example: 'Rights offer notifications processed successfully',
  })
  message: string;

  @ApiProperty({
    example: 120,
    description: 'Eligible clients with available rights > 0',
  })
  eligible_count: number;

  @ApiProperty({
    example: 85,
    description: 'Clients that received at least one successful FCM send',
  })
  notified_count: number;

  @ApiProperty({
    example: 30,
    description: 'Eligible clients with no FCM token registered',
  })
  skipped_no_token: number;

  @ApiProperty({
    example: 5,
    description: 'Eligible clients where FCM send failed',
  })
  failed_count: number;
}
