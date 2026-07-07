import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class CheckExistRequestDto {
  @ApiProperty({ description: 'Symbol id for the rights offer', example: 20 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  symbol_id: number;

  @ApiProperty({
    description: 'Corporate announcement id for the rights offer',
    example: 120,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  corp_announcement_id: number;
}
