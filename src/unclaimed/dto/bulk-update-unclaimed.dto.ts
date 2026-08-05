import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class BulkUpdateUnclaimedDto {
  @ApiProperty({
    description: 'Client CID that owns the records (must match GET cid)',
    example: '11505002806',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'cid must contain only digits' })
  cid: string;

  @ApiProperty({
    description: 'Record IDs from GET /unclaimed/:cid to update',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];

  @ApiProperty({
    description: 'Bank Name (stored in name_of_bank)',
    example: '1010',
  })
  @IsString()
  @IsNotEmpty()
  name_of_bank: string;

  @ApiProperty({
    description: 'Account Number (digits only)',
    example: '102440786',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'account_no must contain only digits' })
  account_no: string;

  @ApiProperty({
    description: 'Account Holder CID (exactly 11 digits)',
    example: '11505002806',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message: 'account_holder_cid must be exactly 11 digits',
  })
  account_holder_cid: string;

  @ApiProperty({
    description: 'Account Holder Name',
    example: 'PHUNTSHO LHAMO',
  })
  @IsString()
  @IsNotEmpty()
  account_holder_name: string;
}

export class BulkUpdateUnclaimedResponseDto {
  @ApiProperty({ example: false })
  error: boolean;

  @ApiProperty({
    example: 'Unclaimed details submitted for verification successfully',
  })
  message: string;

  @ApiProperty({
    example: {
      cid: '11505002806',
      updated_count: 3,
      status: 'Under Verification',
    },
  })
  data: {
    cid: string;
    updated_count: number;
    status: string;
  };
}
