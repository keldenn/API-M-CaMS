import { ApiProperty } from '@nestjs/swagger';

export class FcmResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'FCM token registered successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Additional data',
    required: false,
  })
  data?: any;
}

export class FcmTokenListDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'List of FCM tokens',
    type: 'array',
  })
  tokens: Array<{
    fcm_token_id: number;
    cd_code: string;
    device_id: string;
    platform: string;
    device_name: string;
    app_version: string;
    last_used_at: Date;
    created_at: Date;
  }>;

  @ApiProperty({
    description: 'Total count of tokens',
    example: 3,
  })
  count: number;
}








