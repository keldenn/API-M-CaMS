import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CdCodeRequestDto {
  @ApiPropertyOptional({
    description:
      'Client account identifier used to filter institutional accounts',
    example: '10811000167',
    default: '10811000167',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'cid must contain only digits' })
  cid?: string;
}
