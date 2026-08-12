import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class NdiBillSubmitDto {
  @ApiProperty({ example: '12345678901', description: 'Citizen ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(11)
  cid: string;

  @ApiProperty({ example: 'CD12345', description: 'Client code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  cd_code: string;

  @ApiProperty({
    example: 'thread-abc-123',
    description: 'NDI verification thread ID',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  thread_id: string;

  @ApiProperty({ example: 'ORD-2026-001', description: 'Order number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  order_no: string;
}

export class NdiBillSubmittedDataDto {
  @ApiProperty({
    example: ['5f2e9b8a-1c34-4b2d-9e2a-6f7c8d9a0b1c'],
    description: 'Thread IDs successfully marked as billed by NDI',
  })
  updated: string[];

  @ApiProperty({
    example: [],
    description: 'Thread IDs not matched to an NDI proof-request thread',
  })
  not_found: string[];
}

export class NdiBillSubmittedApiResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Usage events marked as submitted' })
  message: string;

  @ApiProperty({ type: NdiBillSubmittedDataDto })
  data: NdiBillSubmittedDataDto;
}

export class NdiBillSubmitResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Billing record submitted successfully' })
  message: string;

  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({
    type: NdiBillSubmittedApiResponseDto,
    required: false,
    description: 'Response from NDI bill-submitted API',
  })
  ndi?: NdiBillSubmittedApiResponseDto;

  @ApiProperty({
    required: false,
    description: 'Error message if NDI bill-submitted call failed after local save',
  })
  ndi_error?: string;
}
